// Optional same-pod bootstrap gateway. Uptime Kuma remains the original engine.
const http=require('http'),crypto=require('crypto');
const password=process.env.KUMAEDGE_FRONT_DOOR_PASSWORD;
if(!password||Buffer.byteLength(password)<32){console.error('A private front-door password of at least 32 bytes is required');process.exit(2);}
const expected=crypto.createHash('sha256').update('Basic '+Buffer.from('owner:'+password).toString('base64')).digest();
const permitted=req=>crypto.timingSafeEqual(expected,crypto.createHash('sha256').update(req.headers.authorization||'').digest());
const cache={'cache-control':'private, no-store, max-age=0','pragma':'no-cache','expires':'0'};
const upstream={hostname:'127.0.0.1',port:Number(process.env.KUMAEDGE_UPSTREAM_PORT||3001)};
const headers=req=>{const h={...req.headers};delete h.authorization;return h;};
const server=http.createServer((req,res)=>{
 if(req.url==='/healthz'){
  const probe=http.get({...upstream,path:'/'},r=>{r.resume();res.writeHead(r.statusCode<400?200:503,cache);res.end();});
  probe.setTimeout(3000,()=>probe.destroy());probe.on('error',()=>{res.writeHead(503,cache);res.end();});return;
 }
 if(!permitted(req)){res.writeHead(401,{...cache,'www-authenticate':'Basic realm="KumaEdge owner", charset="UTF-8"'});res.end('Owner authentication required');return;}
 const proxy=http.request({...upstream,path:req.url,method:req.method,headers:headers(req)},r=>{
  res.writeHead(r.statusCode,{...r.headers,...cache});r.on("error",()=>res.destroy());r.pipe(res);
 });
 proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502,cache);res.end();});req.on('aborted',()=>proxy.destroy());req.on('error',()=>proxy.destroy());res.on('close',()=>proxy.destroy());req.pipe(proxy);
});
server.on('upgrade',(req,socket,head)=>{
 if(!permitted(req)){socket.end('HTTP/1.1 401 Unauthorized\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n');return;}
 const proxy=http.request({...upstream,path:req.url,method:req.method,headers:headers(req)});
 proxy.on('upgrade',(res,remote,remoteHead)=>{
  const responseHeaders={...res.headers,...cache};
  socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(responseHeaders).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');
  if(head.length)remote.write(head);if(remoteHead.length)socket.write(remoteHead);
  remote.pipe(socket);socket.pipe(remote);remote.on('error',()=>socket.destroy());socket.on('error',()=>remote.destroy());socket.on('close',()=>remote.destroy());remote.on('close',()=>socket.destroy());
 });
 proxy.on('response',r=>{r.resume();socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');});proxy.on('error',()=>socket.destroy());proxy.end();
});
server.listen(Number(process.env.KUMAEDGE_GATEWAY_PORT||3002),'0.0.0.0',()=>{if(process.send)process.send({port:server.address().port});});
process.on('SIGTERM',()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),10000).unref();});
