// Runs ONLY inside a disposable real Uptime Kuma container; never on a live app.
const {io}=require('socket.io-client');
const http=require('http'),net=require('net'),tls=require('tls'),https=require('https');
const fs=require('fs'),crypto=require('crypto');
const assert=require('assert/strict');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mode=process.argv[2]||'seed';
const credsPath='/app/data/.kumaedge-test-credentials.json';
const socket=io('http://127.0.0.1:3001',{transports:['websocket'],reconnection:false});
const request=(s,event,...args)=>new Promise((resolve,reject)=>s.timeout(30000).emit(event,...args,(err,result)=>err?reject(Error(event+': acknowledgement timeout')):resolve(result)));
const ok=async(event,...args)=>{const r=await request(socket,event,...args); assert.equal(r.ok,true,event+': '+r.msg); return r;};
const listen=(server,port)=>new Promise(r=>server.listen(port,'127.0.0.1',r));
async function connect(s){await new Promise((resolve,reject)=>{s.once('info',()=>setTimeout(resolve,250));s.once('connect_error',reject);});}
async function main(){
 await connect(socket);
 let credentials;
 if(mode==='seed'){
  credentials={username:'local-acceptance',password:crypto.randomBytes(24).toString('base64url')+'-Aa1!'};
  fs.writeFileSync(credsPath,JSON.stringify(credentials),{mode:0o600});
  await ok('setup',credentials.username,credentials.password);
 }else{credentials=JSON.parse(fs.readFileSync(credsPath));}
 if(credentials.secret){
  const challenge=await request(socket,'login',{username:credentials.username,password:credentials.password});assert.equal(challenge.tokenRequired,true);
  credentials.token=require('notp').totp.gen(require('thirty-two').decode(credentials.secret));
 }
 await ok('login',credentials);
 assert.equal((await fetch('http://127.0.0.1:3001/dashboard',{redirect:'manual'})).status,200);
 console.log('PASS authenticated real WebSocket login and HTTP 200 readiness route');
 if(fs.existsSync('/opt/kumaedge/front-door.cjs')){
  const gatePassword=crypto.randomBytes(40).toString('hex');
  const gateway=require('child_process').spawn(process.execPath,['/opt/kumaedge/front-door.cjs'],{env:{...process.env,KUMAEDGE_FRONT_DOOR_PASSWORD:gatePassword},stdio:'ignore'});
  const headers={authorization:'Basic '+Buffer.from('owner:'+gatePassword).toString('base64')};
  try{
   for(let n=0;n<30;n++){try{await fetch('http://127.0.0.1:3002/healthz');break;}catch{await sleep(100);}}
   const unauth=await fetch('http://127.0.0.1:3002/setup');assert.equal(unauth.status,401);assert.match(unauth.headers.get('cache-control'),/no-store/);
   const auth=await fetch('http://127.0.0.1:3002/dashboard',{headers});assert.equal(auth.status,200);assert.match(auth.headers.get('cache-control'),/no-store/);
   const gated=io('http://127.0.0.1:3002',{transports:['websocket'],extraHeaders:headers,reconnection:false});await connect(gated);
   const denied=await request(gated,'getMonitorList');assert.equal(denied.ok,false);gated.close();
   console.log('PASS real container owner gateway authentication, no-store and WebSocket forwarding');
  }finally{gateway.kill('SIGTERM');await new Promise(r=>gateway.once('exit',r));}
 }

 const stranger=io('http://127.0.0.1:3001',{transports:['polling'],reconnection:false});
 await connect(stranger);
 const denied=await request(stranger,'getMonitorList');assert.equal(denied.ok,false);stranger.close();
 console.log('PASS polling transport and unauthenticated session isolation');
 if(mode!=='seed'){
  const listEvent=new Promise(r=>socket.once('monitorList',r));await ok('getMonitorList');const monitors=await listEvent;assert.ok(Object.keys(monitors).length>=2);
  for(const m of Object.values(monitors)){
   const beats=await ok('getMonitorBeats',m.id,24);assert.ok(beats.data.length>0);
   const baseline=JSON.parse(fs.readFileSync('/app/data/.kumaedge-test-history.json'));assert.ok(beats.data.length>=baseline[m.id]);
  }
  console.log('PASS persisted users, monitors and heartbeat history after restart/restore');
  return;
 }
 let healthy=true; const received=[];
 const web=http.createServer((req,res)=>{res.writeHead(healthy?200:503);res.end('controlled acceptance target');});
 const receiver=http.createServer((req,res)=>{let body='';req.on('data',c=>body+=c);req.on('end',()=>{received.push(JSON.parse(body));res.end('ok');});});
 const tcp=net.createServer(s=>s.end());
 await listen(web,18081);await listen(receiver,18082);await listen(tcp,18083);
 const notification=await ok('addNotification',{name:'local-only-webhook',type:'webhook',isDefault:false,webhookURL:'http://127.0.0.1:18082',webhookContentType:'application/json'},null);
 const defaults={interval:2,retryInterval:2,resendInterval:0,maxretries:0,active:true,accepted_statuscodes:['200-299'],kafkaProducerBrokers:[],kafkaProducerSaslOptions:{},rabbitmqNodes:[],conditions:[],notificationIDList:{},timeout:2,method:'GET',upsideDown:false,expiryNotification:false,ignoreTls:false};
 const add=async(m)=> (await ok('add',{...defaults,...m})).monitorID;
 const httpId=await add({name:'controlled-http',type:'http',url:'http://127.0.0.1:18081',notificationIDList:{[notification.id]:true}});
 const tcpId=await add({name:'controlled-tcp',type:'port',hostname:'127.0.0.1',port:18083,smtpSecurity:'nostarttls'});
 const waitBeat=async(id,status)=>{for(let n=0;n<40;n++){const r=await ok('getMonitorBeats',id,24);if(r.data.at(-1)?.status===status)return r.data;await sleep(1000);}throw Error('Missing heartbeat status '+status+' monitor '+id);};
 await waitBeat(httpId,1);await waitBeat(tcpId,1);
 console.log('PASS real HTTP/TCP monitors and persisted UP heartbeats');
 healthy=false;await waitBeat(httpId,0);
 for(let n=0;n<15&&!received.some(x=>x.heartbeat?.status===0);n++)await sleep(1000);
 assert.ok(received.some(x=>x.heartbeat?.status===0));
 healthy=true;await waitBeat(httpId,1);
 for(let n=0;n<15&&!received.some(x=>x.heartbeat?.status===1);n++)await sleep(1000);
 assert.ok(received.some(x=>x.heartbeat?.status===1));
 console.log('PASS real DOWN and recovery webhook delivery to controlled local receiver');
 await ok('addStatusPage','Local acceptance','local-acceptance');
 const response=await fetch('http://127.0.0.1:3001/status/local-acceptance');assert.equal(response.status,200);
 console.log('PASS public status page route');
 fs.mkdirSync('/app/data/acceptance-assets',{recursive:true});fs.writeFileSync('/app/data/acceptance-assets/sentinel.txt','preserve complete volume\n');
 for(const id of [httpId,tcpId])await ok('pauseMonitor',id);
 const baseline={};for(const id of [httpId,tcpId])baseline[id]=(await ok('getMonitorBeats',id,24)).data.length;
 fs.writeFileSync('/app/data/.kumaedge-test-history.json',JSON.stringify(baseline),{mode:0o600});
 const prepared=await ok('prepare2FA',credentials.password);
 credentials.secret=new URL(prepared.uri).searchParams.get('secret');
 const otp=require('notp').totp.gen(require('thirty-two').decode(credentials.secret));
 await ok('verifyToken',otp,credentials.password);await ok('save2FA',credentials.password);
 fs.writeFileSync(credsPath,JSON.stringify(credentials),{mode:0o600});
 console.log('PASS real 2FA enrollment and TOTP verification');
 web.close();receiver.close();tcp.close();
}
main().then(()=>{socket.close();process.exit(0);}).catch(e=>{console.error('FAIL:',e.message);socket.close();process.exit(1);});
