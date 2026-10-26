// Demo is an independent read-only application. It never proxies user requests.
'use strict';
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const COOKIE='__Host-kumaedge_demo',PRE='__Host-kumaedge_demo_login';
const safeHeaders={'cache-control':'private, no-store, max-age=0','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','referrer-policy':'same-origin','x-frame-options':'DENY','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){
 if(!/^[a-f0-9]{32}$/.test(salt)||Buffer.byteLength(password)<16||Buffer.byteLength(password)>1024)throw Error('Password must be 16–1024 bytes');
 return 'scrypt$16384$8$1$'+salt+'$'+crypto.scryptSync(password,Buffer.from(salt,'hex'),32,{N:16384,r:8,p:1,maxmem:33554432}).toString('hex');
}
function createDemo(env,upstream){
 if(env.KUMAEDGE_DEMO_ENABLED!=='true')return null;
 const hash=env.KUMAEDGE_DEMO_PASSWORD_HASH||'',parts=hash.split('$'),secret=env.KUMAEDGE_DEMO_SESSION_SECRET||'';
 if(!/^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(hash)||Buffer.byteLength(secret)<32)throw Error('Demo needs a fixed-parameter scrypt hash and a separate session secret');
 if(secret===env.KUMAEDGE_FRONT_DOOR_PASSWORD)throw Error('Demo and owner secrets must differ');
 const origin=new URL(env.KUMAEDGE_PUBLIC_ORIGIN);if(origin.protocol!=='https:'||origin.origin!==env.KUMAEDGE_PUBLIC_ORIGIN)throw Error('Demo public origin must be canonical HTTPS');
 const ttl=Number(env.KUMAEDGE_DEMO_SESSION_TTL||3600);if(!Number.isInteger(ttl)||ttl<60||ttl>86400)throw Error('Demo TTL must be 60–86400 seconds');
 const title=(env.KUMAEDGE_DEMO_PUBLIC_TITLE||'Service health').slice(0,100),username=env.KUMAEDGE_DEMO_USERNAME||'demo';
 const slug=env.KUMAEDGE_DEMO_STATUS_PAGE||'';if(slug&&!/^[a-z0-9-]{1,80}$/.test(slug))throw Error('Invalid public status page slug');
 const allow=JSON.parse(env.KUMAEDGE_DEMO_SERVICES||'[]');
 if(!Array.isArray(allow)||allow.length>50||allow.some(s=>!Number.isSafeInteger(s.id)||s.id<1||typeof s.label!=='string'||!s.label.trim()||s.label.length>100)||new Set(allow.map(s=>s.id)).size!==allow.length)throw Error('Invalid demo service allowlist');
 const sessions=new Map(),rates=new Map();let loginBusy=false,lastData=null,lastFetch=0,pending=null;
 const mac=v=>crypto.createHmac('sha256',secret).update(v).digest('base64url');
 const same=(a,b)=>{const x=crypto.createHash('sha256').update(a).digest(),y=crypto.createHash('sha256').update(b).digest();return crypto.timingSafeEqual(x,y);};
 const signed=v=>v+'.'+mac(v);
 const verify=v=>{if(typeof v!=='string'||v.length>256)return null;const i=v.lastIndexOf('.'),x=v.slice(0,i);return i>0&&same(v.slice(i+1),mac(x))?x:null;};
 const cookie=(name,value,age)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
 const cookies=req=>{const out={};for(const p of (req.headers.cookie||'').split(';')){const i=p.indexOf('=');if(i>0){const k=p.slice(0,i).trim();if(out[k]!==undefined)out[k]='';else out[k]=p.slice(i+1).trim();}}return out;};
 const send=(res,status,body='',headers={})=>{res.writeHead(status,{...safeHeaders,'content-type':'text/html; charset=utf-8',...headers});res.end(body);};
 const page=body=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · KumaEdge Demo</title><link rel="stylesheet" href="/demo/assets/demo.css"><body><main><header><span class="brand">KumaEdge <b>DEMO · READ ONLY</b></span><h1>${esc(title)}</h1><p>Public service health. Owner controls remain private.</p></header>${body}<footer>Read-only monitoring · Times shown in your local timezone</footer></main></body></html>`;
 const body=req=>new Promise((resolve,reject)=>{let data='';req.on('data',b=>{data+=b;if(Buffer.byteLength(data)>4096){reject(Error('body'));req.destroy();}});req.on('end',()=>resolve(data));req.on('error',reject);});
 const sweep=()=>{const now=Date.now();for(const [k,v] of sessions)if(v.expires<=now)sessions.delete(k);for(const [k,v] of rates)if(v.until<=now)rates.delete(k);};
 function limit(req){sweep(); // Socket address is the only trusted peer; spoofed forwarding headers are ignored.
  const key=req.socket.remoteAddress||'unknown',now=Date.now();let v=rates.get(key);if(!v){if(rates.size>=1024)return false;v={n:0,until:now+60000};rates.set(key,v);}return ++v.n<=10;
 }
 const csrfOK=(req,c,form)=>{const token=verify(c[PRE]);return req.headers.origin===origin.origin&&token&&/^\d+:[A-Za-z0-9_-]{32}$/.test(token)&&Date.now()-Number(token.split(':')[0])>=0&&Date.now()-Number(token.split(':')[0])<600000&&same(form.get('csrf')||'',c[PRE]);};
 const session=c=>{sweep();const id=verify(c[COOKIE]);return id?sessions.get(id):null;};
 async function getJSON(route){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),5000);try{const r=await fetch(`http://${upstream.hostname}:${upstream.port}${route}`,{signal:ctrl.signal,redirect:'error'});if(!r.ok)throw Error('unavailable');const length=Number(r.headers.get('content-length'));if(length>2e6)throw Error('size');const reader=r.body.getReader();let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2e6){await reader.cancel();throw Error('size');}chunks.push(Buffer.from(value));}return JSON.parse(Buffer.concat(chunks).toString());}finally{clearTimeout(timer);}}
 async function data(){
  if(!slug||!allow.length)return {state:'empty',services:[],checkedAt:new Date().toISOString()};
  if(lastData&&Date.now()-lastFetch<10000)return lastData;if(pending)return pending;
  pending=(async()=>{const [page,hb]=await Promise.all([getJSON('/api/status-page/'+slug),getJSON('/api/status-page/heartbeat/'+slug)]);
   const publicIDs=new Set((page.publicGroupList||[]).flatMap(g=>(g.monitorList||[]).map(m=>m.id)));
   const services=allow.filter(s=>publicIDs.has(s.id)).map(s=>{const beats=(hb.heartbeatList?.[s.id]||[]).slice(-60).map(b=>({time:typeof b.time==='string'&&/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z?$/.test(b.time)?b.time:null,status:[0,1,2,3].includes(b.status)?b.status:null,ping:typeof b.ping==='number'&&Number.isFinite(b.ping)?Math.max(0,Math.min(86400000,b.ping)):null}));const last=beats.at(-1);const u=hb.uptimeList?.[s.id+'_24'];return {label:s.label,status:last?.status??null,lastCheck:last?.time??null,responseMs:last?.ping??null,uptime24h:typeof u==='number'&&u>=0&&u<=1?u:null,history:beats};});
   const incidents=services.flatMap(s=>s.history.filter((b,i,a)=>(b.status===0||b.status===1)&&i>0&&a[i-1].status!==b.status).map(b=>({label:s.label,time:b.time,event:b.status===0?'down':'recovered'}))).slice(-50);
   lastData={state:services.length?'ok':'empty',engine:'reachable',services,incidents,checkedAt:new Date().toISOString()};lastFetch=Date.now();return lastData;
  })();try{return await pending;}finally{pending=null;}
 }
 return async(req,res,pathname)=>{
  const c=cookies(req),current=session(c);
  if(pathname==='/demo/assets/demo.css'||pathname==='/demo/assets/demo.js'){
   if(req.method!=='GET'){send(res,405);return;}
   const filename=path.basename(pathname);send(res,200,fs.readFileSync(path.join(__dirname,'demo-assets',filename)),{'content-type':filename.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});return;
  }
  if(pathname==='/demo/login'){
   if(req.method==='GET'){const token=signed(Date.now()+':'+crypto.randomBytes(24).toString('base64url'));send(res,200,page(`<section class="login"><h2>Demo access</h2><p>Sign in to view the read-only dashboard.</p><form method="post" action="/demo/login"><input type="hidden" name="csrf" value="${esc(token)}"><label>Username<input name="username" autocomplete="username" required maxlength="100"></label><label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="1024"></label><button>View service health</button></form></section>`),{'set-cookie':cookie(PRE,token,600)});return;}
   if(req.method!=='POST'){send(res,405);return;}
   if(!limit(req)||loginBusy){send(res,429,'Please try again later',{'retry-after':'60'});return;}
   if(req.headers['content-type']!=='application/x-www-form-urlencoded'){send(res,415);return;}
   let form;try{form=new URLSearchParams(await body(req));}catch{send(res,400);return;}
   if(!csrfOK(req,c,form)){send(res,403,'Sign-in form expired');return;}
   const password=form.get('password')||'';if(Buffer.byteLength(password)<16||Buffer.byteLength(password)>1024){send(res,401,'Invalid credentials');return;}
   loginBusy=true;let derived;try{derived=await new Promise((resolve,reject)=>crypto.scrypt(password,Buffer.from(parts[4],'hex'),32,{N:16384,r:8,p:1,maxmem:33554432},(e,v)=>e?reject(e):resolve(v)));}finally{loginBusy=false;}
   if(!same(form.get('username')||'',username)||!crypto.timingSafeEqual(derived,Buffer.from(parts[5],'hex'))){send(res,401,'Invalid credentials');return;}
   if(sessions.size>=1000){send(res,503,'Session capacity reached');return;}
   const old=verify(c[COOKIE]);if(old)sessions.delete(old);const id=crypto.randomBytes(32).toString('base64url'),csrf=crypto.randomBytes(24).toString('base64url');sessions.set(id,{expires:Date.now()+ttl*1000,csrf});send(res,303,'',{location:'/demo','set-cookie':[cookie(COOKIE,signed(id),ttl),cookie(PRE,'',0)]});return;
  }
  if(!current){send(res,pathname==='/demo'||pathname==='/demo/'?303:401,'',{...(pathname==='/demo'||pathname==='/demo/'?{location:'/demo/login'}:{})});return;}
  if(pathname==='/demo/logout'){
   if(req.method!=='POST'){send(res,405);return;}let form;try{form=new URLSearchParams(await body(req));}catch{send(res,400);return;}
   if(req.headers.origin!==origin.origin||!same(form.get('csrf')||'',current.csrf)){send(res,403);return;}
   sessions.delete(verify(c[COOKIE]));send(res,303,'',{location:'/demo/login','set-cookie':cookie(COOKIE,'',0)});return;
  }
  if(req.method!=='GET'){send(res,405);return;}
  if(pathname==='/demo/api/status'){try{send(res,200,JSON.stringify(await data()),{'content-type':'application/json; charset=utf-8'});}catch{send(res,503,JSON.stringify({state:'unavailable',services:[]}),{'content-type':'application/json; charset=utf-8'});}return;}
  if(pathname==='/demo'||pathname==='/demo/'){send(res,200,page(`<div class="toolbar"><span>Auto refresh · 30 seconds</span><form method="post" action="/demo/logout"><input type="hidden" name="csrf" value="${current.csrf}"><button class="secondary">Sign out</button></form></div><section id="summary" role="status">Loading current health…</section><section id="services" class="grid"></section><section id="incidents"></section><p id="updated"></p><script src="/demo/assets/demo.js" defer></script>`));return;}
  send(res,404,'Not found');
 };
}
module.exports={createDemo,hashPassword};
