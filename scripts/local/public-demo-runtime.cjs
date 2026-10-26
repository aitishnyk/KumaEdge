'use strict';
// Executes inside the exact release image, with no volume or remote network.
const {createDemo,hashPassword}=require('/opt/kumaedge/demo-mode.cjs'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');
(async()=>{
assert.throws(()=>hashPassword('demo'));
const handler=createDemo({KUMAEDGE_DEMO_ENABLED:'true',KUMAEDGE_DEMO_PUBLIC_CREDENTIALS:'true',KUMAEDGE_DEMO_PASSWORD_HASH:hashPassword('demo',undefined,{publicCredentials:true}),KUMAEDGE_DEMO_SESSION_SECRET:crypto.randomBytes(48).toString('hex'),KUMAEDGE_PUBLIC_ORIGIN:'https://demo.example'},{hostname:'127.0.0.1',port:1});
const server=http.createServer((req,res)=>handler(req,res,new URL(req.url,'http://localhost').pathname).catch(()=>{res.writeHead(500);res.end();}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{const origin='http://127.0.0.1:'+server.address().port;
for(let i=0;i<12;i++){
 const first=await fetch(origin+'/demo/login'),text=await first.text();assert.match(text,/Public Demo Access/);const cookie=first.headers.getSetCookie()[0].split(';')[0],csrf=text.match(/name="csrf" value="([^"]+)"/)[1];
 const r=await fetch(origin+'/demo/login',{method:'POST',redirect:'manual',headers:{origin:'https://demo.example',cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'demo',password:i===0?'wrong':'demo',csrf})});assert.equal(r.status,i===0?401:303);
 if(i>0){const c=r.headers.getSetCookie()[0].split(';')[0];assert.equal((await fetch(origin+'/demo/api/status',{headers:{cookie:c}})).status,200);}
}
console.log('PASS exact image public demo/demo, wrong-password denial, shared-peer signins and unchanged private password policy');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(()=>{console.error('FAIL Docker public demo runtime');process.exitCode=1;});
