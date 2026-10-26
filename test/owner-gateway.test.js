import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
test('owner gateway protects setup, strips bootstrap credentials, prevents caching and forwards real WebSocket upgrades', async()=>{
 const origin=http.createServer((req,res)=>{assert.equal(req.headers.authorization,undefined);res.writeHead(200,{'cache-control':'public,max-age=86400'});res.end('original engine');});
 origin.on('upgrade',(req,socket)=>{assert.equal(req.headers.authorization,undefined);socket.end('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');});
 origin.listen(0,'127.0.0.1');await once(origin,'listening');
 const password=randomBytes(32).toString('base64url');
 const child=fork('scripts/front-door.cjs',[],{stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,KUMAEDGE_FRONT_DOOR_PASSWORD:password,KUMAEDGE_GATEWAY_PORT:'0',KUMAEDGE_UPSTREAM_PORT:String(origin.address().port)}});
 try{
  const [{port}]=await once(child,'message');const base='http://127.0.0.1:'+port;
  let response=await fetch(base+'/setup');assert.equal(response.status,401);assert.match(response.headers.get('cache-control'),/no-store/);
  const authorization='Basic '+Buffer.from('owner:'+password).toString('base64');
  response=await fetch(base+'/setup',{headers:{authorization}});assert.equal(await response.text(),'original engine');assert.match(response.headers.get('cache-control'),/private, no-store/);
  response=await fetch(base+'/healthz');assert.equal(response.status,200);
  await new Promise((resolve,reject)=>{const req=http.request(base+'/socket.io/?EIO=4&transport=websocket',{headers:{authorization,connection:'Upgrade',upgrade:'websocket'}});req.on('upgrade',(r,s)=>{assert.equal(r.statusCode,101);assert.match(r.headers['cache-control'],/no-store/);s.destroy();resolve();});req.on('response',r=>reject(Error('Upgrade failed '+r.statusCode)));req.on('error',reject);req.end();});
 }finally{child.kill('SIGTERM');await once(child,'exit');origin.closeAllConnections();await new Promise(r=>origin.close(r));}
});
