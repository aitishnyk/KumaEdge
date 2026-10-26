// Privileged local operator client; secrets arrive only via process environment.
'use strict';
const {io}=require('socket.io-client'),assert=require('assert/strict'),crypto=require('crypto'),fs=require('fs');
const url=process.env.KUMAEDGE_PUBLIC_URL||'https://mc-b4n2u1709h.bunny.run';
const headers={authorization:'Basic '+Buffer.from('owner:'+process.env.KUMAEDGE_FRONT_DOOR_PASSWORD).toString('base64')};
const user={username:'owner',password:process.env.KUMAEDGE_OWNER_PASSWORD};
let lastOperation='connect';
const request=(s,event,...args)=>{lastOperation=event;return new Promise((resolve,reject)=>s.timeout(30000).emit(event,...args,(e,v)=>e?reject(Error('Request timeout: '+event)):resolve(v)));};
const otp=secret=>require('notp').totp.gen(require('thirty-two').decode(secret));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const s=io(url,{transports:['websocket'],extraHeaders:headers,reconnection:false,timeout:20000});
const report={scope:new URL(url).hostname==='127.0.0.1'?'LOCAL_DISPOSABLE':'ACTUAL_BUNNY',owner:'NOT_RUN',totp:'NOT_RUN',monitoring:'NOT_RUN',externalNotifications:'NOT_VERIFIED_NO_AUTHORIZED_CHANNEL'};
async function ok(event,...args){const r=await request(s,event,...args);if(r?.ok!==true)throw Error('Operation refused: '+event);return r;}
async function login(secret){
 const r=await request(s,'login',user);
 if(r.tokenRequired){
  assert.ok(secret,'Trusted local TOTP identity required');
  let result=await request(s,'login',{...user,token:otp(secret)});
  // Kuma rejects replay of a successfully used TOTP. Wait for the next real
  // time step; never clear the last-token state or bypass the factor.
  if(result.ok!==true){console.log('Waiting for fresh real TOTP time step after token rejection');await sleep(31000-Date.now()%30000);result=await request(s,'login',{...user,token:otp(secret)});}
  assert.equal(result.ok,true,'Fresh owner TOTP login failed');
 }else assert.equal(r.ok,true,'Owner login failed');
}
async function main(){
 await new Promise((resolve,reject)=>{s.once('info',()=>setTimeout(resolve,300));s.once('connect_error',()=>reject(Error('Protected gateway unavailable')));});
 const setup=await request(s,'needSetup');let secret=process.env.KUMAEDGE_OWNER_TOTP_SECRET;
 if(setup===true){assert.equal(process.env.KUMAEDGE_PERMIT_FRESH_SETUP,'true');await ok('setup',user.username,user.password);}
 await login(secret);
 if(!secret){
  const prepared=await ok('prepare2FA',user.password);secret=new URL(prepared.uri).searchParams.get('secret');assert.ok(secret);await ok('verifyToken',otp(secret),user.password);await ok('save2FA',user.password);
  fs.writeFileSync('/tmp/kumaedge-bootstrap-secrets.private.json',JSON.stringify({totpSecret:secret}),{mode:0o600});
 }
 if(process.env.KUMAEDGE_BOOTSTRAP_MODE!=='check'){await request(s,'logout');const challenge=await request(s,'login',user);assert.equal(challenge.tokenRequired,true);const invalid=otp(secret)==='000000'?'000001':'000000';assert.notEqual((await request(s,'login',{...user,token:invalid})).ok,true);await login(secret);}report.owner='PASS';report.totp='PASS';
 if(process.env.KUMAEDGE_BOOTSTRAP_MODE==='check'){
  const monitors=await new Promise(async(resolve,reject)=>{s.once('monitorList',resolve);try{await ok('getMonitorList');}catch(e){reject(e);}});report.monitorCount=Object.keys(monitors).length;
  report.history={};for(const m of Object.values(monitors)){const r=await ok('getMonitorBeats',m.id,24);report.history[m.id]=r.data.length;assert.ok(r.data.length>0);}
  report.monitoring='PASS_PERSISTED';return;
 }
 const existing=await new Promise(async(resolve,reject)=>{s.once('monitorList',resolve);try{await ok('getMonitorList');}catch(e){reject(e);}});
 const defaults={interval:60,retryInterval:60,resendInterval:0,maxretries:0,active:true,accepted_statuscodes:['200-299'],kafkaProducerBrokers:[],kafkaProducerSaslOptions:{},rabbitmqNodes:[],conditions:[],notificationIDList:{},timeout:15,method:'GET',upsideDown:false,expiryNotification:false,ignoreTls:false};
 const definitions=[{name:'KumaEdge HTTPS acceptance',type:'http',url:'https://example.com',expiryNotification:true},{name:'KumaEdge TCP acceptance',type:'port',hostname:'example.com',port:443,smtpSecurity:'nostarttls'},{name:'KumaEdge controlled acceptance',type:'http',url:'http://127.0.0.1:3003/target',interval:20,retryInterval:20,timeout:5}];
 const ids=[];for(const definition of definitions){const found=Object.values(existing).find(m=>m.name===definition.name);ids.push(found?found.id:(await ok('add',{...defaults,...definition})).monitorID);}
 assert.deepEqual(ids,[1,2,3],'Fresh dataset IDs differ from reviewed public allowlist');
 const beat=async(id,status)=>{for(let n=0;n<120;n++){const r=await ok('getMonitorBeats',id,24);if(r.data.at(-1)?.status===status)return r.data;await sleep(1000);}throw Error('Heartbeat acceptance timeout');};
 for(const id of ids)await beat(id,1);console.log('PASS actual HTTPS/TCP/controlled monitors UP');
 const target=async(state)=>{const r=await fetch(url+'/__kumaedge/target/'+state,{method:'POST',headers:{...headers,'x-kumaedge-ops-token':process.env.KUMAEDGE_OPS_TOKEN},redirect:'error'});assert.equal(r.status,204);};
 try{await target('down');await beat(ids[2],0);await target('up');await beat(ids[2],1);}finally{await target('up');}
 console.log('PASS actual controlled DOWN and recovery persisted');
 const slug='kumaedge-demo';let config;
 try{config=(await ok('getStatusPage',slug)).config;}catch{await ok('addStatusPage','KumaEdge service health',slug);config=(await ok('getStatusPage',slug)).config;}
 await ok('saveStatusPage',slug,config,'',[{name:'Public acceptance services',monitorList:ids.map(id=>({id}))}]);
 report.monitors=ids;report.publicSlug=slug;report.monitoring='PASS';report.httpsCertificate='PASS_VERIFIED_HTTPS_MONITOR';report.controlledDownUp='PASS';
 report.history={};for(const id of ids)report.history[id]=(await ok('getMonitorBeats',id,24)).data.length;
 await request(s,'logout');assert.equal((await request(s,'getMonitorList')).ok,false);await login(secret);report.logoutRelogin='PASS';
}
main().then(()=>{fs.writeFileSync('/tmp/kumaedge-bootstrap-result.json',JSON.stringify(report),{mode:0o600});console.log('PASS protected owner and monitoring acceptance phase');}).catch(error=>{console.error('Live operator phase failed at:',lastOperation);process.exitCode=1;}).finally(()=>s.close());
