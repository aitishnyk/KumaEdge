// Optional same-pod bootstrap gateway. Uptime Kuma remains the original engine.
const http=require('http'),crypto=require('crypto');
const password=process.env.KUMAEDGE_FRONT_DOOR_PASSWORD;
if(!password||Buffer.byteLength(password)<32){console.error('A private front-door password of at least 32 bytes is required');process.exit(2);}
const expected=crypto.createHash('sha256').update('Basic '+Buffer.from('owner:'+password).toString('base64')).digest();
const permitted=req=>crypto.timingSafeEqual(expected,crypto.createHash('sha256').update(req.headers.authorization||'').digest());
const cache={'cache-control':'private, no-store, max-age=0','pragma':'no-cache','expires':'0'};
const upstream={hostname:'127.0.0.1',port:Number(process.env.KUMAEDGE_UPSTREAM_PORT||3001)};
const demo=require('./demo-mode.cjs').createDemo(process.env,upstream);
const pathname=req=>{if(!req.url.startsWith('/')||req.url.startsWith('//')||/[\\\x00-\x20]/.test(req.url))return null;const p=req.url.split('?')[0];if(/%(?:2e|2f|5c|25|00)/i.test(p)||p.split('/').some(s=>s==='.'||s==='..'))return null;return p;};
const isDemo=p=>p==='/demo'||p.startsWith('/demo/');
const headers=req=>{const h={...req.headers};for(const k of Object.keys(h))if(k==='authorization'||k==='forwarded'||k==='x-real-ip'||k.startsWith('x-forwarded-')||k.startsWith('x-kumaedge-'))delete h[k];h.host=upstream.hostname+':'+upstream.port;if(h.cookie){h.cookie=h.cookie.split(';').filter(p=>!p.trim().startsWith('__Host-kumaedge_demo')).join(';');if(!h.cookie)delete h.cookie;}return h;};
const server=http.createServer((req,res)=>{
 const p=pathname(req);if(['TRACE','CONNECT'].includes(req.method)){res.writeHead(405,cache);res.end();return;}if(p===null){res.writeHead(400,cache);res.end();return;}
 if(isDemo(p)){if(!demo){res.writeHead(404,cache);res.end();return;}demo(req,res,p).catch(()=>{if(!res.headersSent)res.writeHead(500,cache);res.end();});return;}
 if(p.startsWith('/__kumaedge/')){
  if(!permitted(req)){res.writeHead(401,cache);res.end();return;}
  if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)!==0){res.writeHead(400,{...cache,connection:'close'});res.end();return;}
  const routes={'/__kumaedge/backup':'/backup','/__kumaedge/target/up':'/target/up','/__kumaedge/target/down':'/target/down'};
  if(req.method!=='POST'||!routes[req.url]){res.writeHead(404,cache);res.end();return;}
  const proxy=http.request({hostname:'127.0.0.1',port:3003,path:routes[req.url],method:'POST',headers:{'x-kumaedge-ops-token':req.headers['x-kumaedge-ops-token']||''}},r=>{res.writeHead(r.statusCode,{...r.headers,...cache});r.pipe(res);});
  proxy.setTimeout(120000,()=>proxy.destroy());proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502,cache);res.end();});res.on('close',()=>proxy.destroy());proxy.end();return;
 }
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
server.on('connect',(_req,socket)=>socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n'));
server.on('upgrade',(req,socket,head)=>{
 if(!pathname(req)||isDemo(pathname(req))||!permitted(req)){socket.end('HTTP/1.1 401 Unauthorized\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n');return;}
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
