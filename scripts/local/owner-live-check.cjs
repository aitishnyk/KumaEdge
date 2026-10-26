// Only receives secrets through the local Docker process environment.
const {io}=require('socket.io-client');const assert=require('assert/strict');
const request=(s,event,...args)=>new Promise((resolve,reject)=>s.timeout(15000).emit(event,...args,(e,v)=>e?reject(Error('Request timeout')):resolve(v)));
const s=io('https://mc-b4n2u1709h.bunny.run',{transports:['websocket'],extraHeaders:{authorization:'Basic '+Buffer.from('owner:'+process.env.KUMAEDGE_FRONT_DOOR_PASSWORD).toString('base64')},reconnection:false,timeout:15000});
async function main(){await new Promise((resolve,reject)=>{s.once('info',()=>setTimeout(resolve,250));s.once('connect_error',()=>reject(Error('Gateway connection failed')));});const login={username:process.env.KUMAEDGE_OWNER_USERNAME,password:process.env.KUMAEDGE_OWNER_PASSWORD};
const challenge=await request(s,'login',login);assert.equal(challenge.tokenRequired,true,'Owner must enable TOTP in the protected Kuma UI first');
const wrong=await request(s,'login',{...login,token:process.env.KUMAEDGE_OWNER_TOTP==='000000'?'000001':'000000'});assert.notEqual(wrong.ok,true,'Invalid TOTP accepted');
const auth=await request(s,'login',{...login,token:process.env.KUMAEDGE_OWNER_TOTP});assert.equal(auth.ok,true,'Owner login/TOTP rejected');
assert.equal((await request(s,'getMonitorList')).ok,true,'Authenticated admin request failed');
await request(s,'logout');assert.equal((await request(s,'getMonitorList')).ok,false,'Logout retained admin privileges');
console.log(JSON.stringify({gateway:'PASS',ownerLogin:'PASS',requiredTOTP:'PASS',invalidTOTP:'REJECTED',authenticatedAdmin:'PASS',logoutIsolation:'PASS',monitoringPersistence:'NOT_RUN',sessionExpiration:'NOT_RUN'}));}
main().catch(()=>{console.error('Owner live check failed; verify credentials, current TOTP and enrollment privately.');process.exitCode=1;}).finally(()=>s.close());
