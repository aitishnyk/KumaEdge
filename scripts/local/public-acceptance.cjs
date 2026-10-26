// Run inside the tested image, against the actual HTTPS owner gateway.
const {io}=require('socket.io-client');const assert=require('assert/strict');
async function main(){
 const url=new URL(process.env.KUMAEDGE_PUBLIC_URL);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');
 const password=process.env.KUMAEDGE_FRONT_DOOR_PASSWORD;assert.ok(password?.length>=32,'Owner gateway credential required privately');
 const headers={authorization:'Basic '+Buffer.from('owner:'+password).toString('base64')};
 const cache=r=>{assert.match(r.headers.get('cache-control')||'',/no-store/i);assert.ok(Number(r.headers.get('age')||0)===0);for(const h of ['cdn-cache','cdn-cache-status','x-cache','cache-status'])assert.doesNotMatch(r.headers.get(h)||'',/\bhit\b/i);};
 const anon=await fetch(new URL('/setup',url),{redirect:'manual'});assert.equal(anon.status,401);cache(anon);
 const dashboard=await fetch(new URL('/dashboard',url),{headers,redirect:'manual'});assert.equal(dashboard.status,200);cache(dashboard);
 const polling=await fetch(new URL('/socket.io/?EIO=4&transport=polling',url),{headers});assert.equal(polling.status,200);cache(polling);assert.match(await polling.text(),/^0\{/);
 const socket=io(url.origin,{transports:['websocket'],extraHeaders:headers,reconnection:false,timeout:15000});
 try{
  await new Promise((resolve,reject)=>{socket.once('info',()=>setTimeout(resolve,250));socket.once('connect_error',reject);});
  const r=await new Promise((resolve,reject)=>socket.timeout(15000).emit('getMonitorList',(err,result)=>err?reject(err):resolve(result)));assert.equal(r.ok,false,'Gateway authentication must not grant Kuma admin access');
 }finally{socket.close();}
 console.log(JSON.stringify({https:'PASS',certificateValidation:'PASS',gatewayIsolation:'PASS',kumaSessionIsolation:'PASS',polling:'PASS',websocket:'PASS',privateNoStore:'PASS',bunnyPersistence:'NOT_RUN',externalNotifications:'NOT_RUN',bunnyFullVolumeRestore:'NOT_RUN'}));
}
main().catch(e=>{console.error('FAIL public acceptance:',e.message);process.exitCode=1;});
