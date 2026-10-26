// Exact local operator client against real public HTTPS. No private values logged.
'use strict';
const {io}=require('socket.io-client'),assert=require('assert/strict'),fs=require('fs');
const base='https://mc-b4n2u1709h.bunny.run',origin=base;
const owner={authorization:'Basic '+Buffer.from('owner:'+process.env.KUMAEDGE_FRONT_DOOR_PASSWORD).toString('base64')};
const check=r=>{assert.match(r.headers.get('cache-control')||'',/private.*no-store/);assert.equal(r.headers.get('cdn-cache'),'BYPASS');assert.ok(!Number(r.headers.get('age')||0));};
const fetcher=(p,o={})=>fetch(base+p,{redirect:'manual',...o});
async function main(){
 let r=await fetcher('/setup');assert.equal(r.status,401);check(r);
 r=await fetcher('/dashboard',{headers:{...owner,'x-forwarded-proto':'http','x-forwarded-host':'untrusted.example','forwarded':'proto=http;host=untrusted.example'}});assert.equal(r.status,200);check(r);
 if(process.env.KUMAEDGE_OLD_DEMO_COOKIE){r=await fetcher('/demo/api/status',{headers:{cookie:process.env.KUMAEDGE_OLD_DEMO_COOKIE}});assert.equal(r.status,401);check(r);}
 r=await fetcher('/demo/login');check(r);const html=await r.text(),pre=r.headers.getSetCookie()[0].split(';')[0],csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
 r=await fetcher('/demo/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded',cookie:pre},body:new URLSearchParams({username:'demo',password:process.env.KUMAEDGE_DEMO_PASSWORD,csrf})});assert.equal(r.status,303);check(r);const raw=r.headers.getSetCookie()[0];assert.match(raw,/Secure; HttpOnly; SameSite=Strict/);const cookie=raw.split(';')[0];fs.writeFileSync('/tmp/demo-live-cookie.private',cookie,{mode:0o600});
 r=await fetcher('/demo/api/status',{headers:{cookie}});assert.equal(r.status,200);check(r);const data=await r.json();assert.equal(data.services.length,3);for(const service of data.services){assert.ok(service.history.length>0);assert.ok([0,1,2,3].includes(service.status));}assert.doesNotMatch(JSON.stringify(data),/127\.0\.0\.1|example\.com|bunny\.run|notification|secret|webhook|3003/);
 for(const p of ['/setup','/dashboard','/settings','/api/entry-page','/socket.io/?EIO=4&transport=polling','/__kumaedge/backup']){r=await fetcher(p,{headers:{cookie}});assert.equal(r.status,401);check(r);}
 r=await fetcher('/demo/api/status',{headers:{cookie:cookie+'tampered'}});assert.equal(r.status,401);check(r);
 r=await fetcher('/demo/api/status',{headers:{authorization:'Basic '+Buffer.from('demo:'+process.env.KUMAEDGE_DEMO_PASSWORD).toString('base64')}});assert.equal(r.status,401);
 r=await fetcher('/demo/login',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/x-www-form-urlencoded',cookie:pre},body:new URLSearchParams({username:'demo',password:process.env.KUMAEDGE_DEMO_PASSWORD,csrf})});assert.equal(r.status,403);
 const denied=io(base,{transports:['websocket'],extraHeaders:{cookie},reconnection:false,timeout:15000});await new Promise((resolve,reject)=>{denied.once('connect',()=>reject(Error('Demo WebSocket escalation')));denied.once('connect_error',resolve);});denied.close();
 const s=io(base,{transports:['websocket'],extraHeaders:owner,reconnection:true,timeout:15000});
 const info=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Reconnect timeout')),25000);s.once('info',()=>{clearTimeout(timer);setTimeout(resolve,300);});s.once('connect_error',()=>{clearTimeout(timer);reject(Error('Transport refused'));});});
 try{await info();const again=info();s.io.engine.close();await again;const result=await new Promise((resolve,reject)=>s.timeout(15000).emit('getMonitorList',(e,v)=>e?reject(e):resolve(v)));assert.equal(result.ok,false);}finally{s.close();}
 r=await fetcher('/demo',{headers:{cookie}});assert.equal(r.status,200);check(r);const logoutCsrf=(await r.text()).match(/name="csrf" value="([^"]+)"/)[1];
 r=await fetcher('/demo/logout',{method:'POST',headers:{origin,cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:logoutCsrf})});assert.equal(r.status,303);r=await fetcher('/demo/api/status',{headers:{cookie}});assert.equal(r.status,401);
 // Create a fresh valid session to check fail-closed invalidation across the agreed restart.
 r=await fetcher('/demo/login');const newpre=r.headers.getSetCookie()[0].split(';')[0],newcsrf=(await r.text()).match(/name="csrf" value="([^"]+)"/)[1];r=await fetcher('/demo/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded',cookie:newpre},body:new URLSearchParams({username:'demo',password:process.env.KUMAEDGE_DEMO_PASSWORD,csrf:newcsrf})});assert.equal(r.status,303);fs.writeFileSync('/tmp/demo-live-cookie.private',r.headers.getSetCookie()[0].split(';')[0],{mode:0o600});
 fs.writeFileSync('/tmp/demo-live-report.json',JSON.stringify({scope:'ACTUAL_BUNNY',demoLogin:'PASS',demoData:'PASS',demoIsolation:'PASS',csrf:'PASS',tamper:'PASS',logout:'PASS',websocketReconnect:'PASS',privateCDNCache:'PASS',staleSessionAfterRestart:process.env.KUMAEDGE_OLD_DEMO_COOKIE?'PASS':'NOT_RUN',demoAbsoluteTTL:'LOCAL_REGRESSION_PASS_PUBLIC_DURATION_NOT_RUN',externalNotifications:'NOT_VERIFIED'}),{mode:0o600});console.log('PASS actual public demo/auth/cache/transport adversarial acceptance');
}
main().catch(()=>{console.error('Public demo acceptance failed; no secrets printed');process.exitCode=1;});
