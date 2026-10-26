// Demo is an independent read-only application. It never proxies user requests.
'use strict';
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const publicLinks=require('./demo-public.cjs');
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
 const external=(url,label,cls='')=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer sponsored" aria-label="${esc(label)}"${cls?` class="${cls}"`:''}>${label}<span aria-hidden="true"> ↗</span></a>`;
 const page=(body,login=false)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Explore KumaEdge: real uptime, response times and recorded service health, powered by original Uptime Kuma."><title>${esc(publicLinks.title)}</title><link rel="stylesheet" href="/demo/assets/demo.css"></head><body class="${login?'login-page':'dashboard-page'}"><div class="ambient" aria-hidden="true"></div><div class="shell"><nav class="navigation" aria-label="Main navigation"><a class="brand" href="/demo" aria-label="KumaEdge demo home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>KumaEdge<span class="version">LIVE DEMO</span></a><div class="nav-links">${external(publicLinks.github,'View on GitHub','nav-link')}${external(publicLinks.bunnyAffiliate,'Deploy with Bunny.net','button button-small')}</div></nav><main id="main"><header class="hero ${login?'hero-login':''}"><div class="eyebrow"><span class="live-dot" aria-hidden="true"></span> REAL CHECKS. READ-ONLY ACCESS.</div><h1>KumaEdge <span class="title-dash">—</span><br><span>Live Monitoring Demo</span></h1><p class="hero-description">A clear view of uptime, response times, and the moments that matter. Real monitoring, without access to the controls.</p><div class="hosting"><span class="cloud-symbol" aria-hidden="true">◈</span> <span>Running on Bunny Magic Containers</span><span class="hosting-divider" aria-hidden="true">/</span><span class="hosting-engine">Original Uptime Kuma 2.5.7</span></div></header>${body}</main><footer><div class="footer-main"><a class="footer-brand" href="/demo">KumaEdge<span>Independent. Open source. Always observable.</span></a><div class="footer-links">${external(publicLinks.github,'View on GitHub')}${external(publicLinks.upstream,'Powered by Uptime Kuma')}${external(publicLinks.bunnyAffiliate,'Hosted on Bunny.net')}</div></div><div class="footer-bottom"><p>${esc(publicLinks.disclosure)}</p><p>Independent project. Not an official Bunny.net or Uptime Kuma product.</p></div></footer></div></body></html>`;

 const loginHTML=(token,error='')=>page(`<section class="login-layout" aria-label="Demo access"><div class="login-story"><span class="section-kicker">OBSERVABILITY, WITHOUT THE NOISE</span><h2>See how your services<br>are really doing.</h2><p>Explore a working monitoring dashboard with actual checks and recorded history. Every number comes from the monitoring engine.</p><div class="feature-list"><div><span aria-hidden="true">01</span><p><strong>Live service health</strong>Availability, latency, and the latest check for each shared service.</p></div><div><span aria-hidden="true">02</span><p><strong>History with context</strong>Response-time charts, check history, and recorded transitions.</p></div><div><span aria-hidden="true">03</span><p><strong>Read-only by design</strong>A separate demo session. No admin controls or private targets.</p></div></div>${external(publicLinks.bunnyAffiliate,'Get Started with Bunny.net','text-link')}</div><section class="login"><div class="login-icon" aria-hidden="true">↗</div><span class="section-kicker">YOUR WINDOW INTO KUMAEDGE</span><h2>Explore the live demo</h2>${error?`<div class="login-error" role="alert">${esc(error)}</div>`:''}<p>Sign in with the demo credentials shared by the project maintainer.</p><form method="post" action="/demo/login"><input type="hidden" name="csrf" value="${esc(token)}"><label for="demo-username">Username</label><input id="demo-username" name="username" autocomplete="username" placeholder="Your demo username" required maxlength="100"><label for="demo-password">Password</label><input id="demo-password" name="password" type="password" autocomplete="current-password" placeholder="Your demo password" required maxlength="1024"><button class="button login-submit">View live monitoring <span aria-hidden="true">→</span></button></form><p class="login-note"><span aria-hidden="true">◇</span> Separate demo access. Owner credentials do not work here.</p></section></section>`,true);
 const renderLogin=(res,status,error='')=>{const token=signed(Date.now()+':'+crypto.randomBytes(24).toString('base64url'));send(res,status,loginHTML(token,error),{'set-cookie':cookie(PRE,token,600)});};
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
   if(req.method==='GET'){renderLogin(res,200);return;}
   if(req.method!=='POST'){send(res,405);return;}
   if(!limit(req)||loginBusy){send(res,429,'Please try again later',{'retry-after':'60'});return;}
   if(req.headers['content-type']!=='application/x-www-form-urlencoded'){send(res,415);return;}
   let form;try{form=new URLSearchParams(await body(req));}catch{send(res,400);return;}
   if(!csrfOK(req,c,form)){renderLogin(res,403,'Your sign-in form expired. Please try again.');return;}
   const password=form.get('password')||'';if(Buffer.byteLength(password)<16||Buffer.byteLength(password)>1024){renderLogin(res,401,'The demo username or password is incorrect.');return;}
   loginBusy=true;let derived;try{derived=await new Promise((resolve,reject)=>crypto.scrypt(password,Buffer.from(parts[4],'hex'),32,{N:16384,r:8,p:1,maxmem:33554432},(e,v)=>e?reject(e):resolve(v)));}finally{loginBusy=false;}
   if(!same(form.get('username')||'',username)||!crypto.timingSafeEqual(derived,Buffer.from(parts[5],'hex'))){renderLogin(res,401,'The demo username or password is incorrect.');return;}
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
  if(pathname==='/demo'||pathname==='/demo/'){send(res,200,page(`<div class="dashboard-heading"><div><span class="section-kicker">LIVE OVERVIEW</span><h2>${esc(title)}</h2></div><div class="toolbar"><span class="refresh-note"><span class="live-dot" aria-hidden="true"></span>Auto refresh · 30s</span><button id="refresh" class="secondary" type="button" aria-label="Refresh monitoring data">↻ Refresh</button><form method="post" action="/demo/logout"><input type="hidden" name="csrf" value="${current.csrf}"><button class="secondary">Sign out</button></form></div></div><section id="summary" class="summary loading" role="status" aria-live="polite"><span class="status-orb" aria-hidden="true">◌</span><div><h2>Connecting to the monitoring engine</h2><p>Loading real service health…</p></div></section><section class="overview-metrics" aria-label="Monitoring overview"><div><span>Services operational</span><strong id="metric-services">—</strong><small>Current recorded state</small></div><div><span>Mean response time</span><strong id="metric-response">—</strong><small>Latest reported measurements</small></div><div><span>Mean service uptime</span><strong id="metric-uptime">—</strong><small>Past 24 hours · reported values</small></div></section><div class="section-heading"><h2>Service health</h2><span>Real checks. Recorded history.</span></div><section id="services" class="grid" aria-label="Public services"></section><section id="incidents" class="events" aria-label="Recorded events"></section><div class="update-line"><span id="updated" role="status">Waiting for the first update…</span><span>Read-only · Local time</span></div><aside class="deploy-banner"><div><span class="section-kicker">TAKE YOUR MONITORING TO THE EDGE</span><h2>Your next deployment starts here.</h2><p>Explore hosting on Bunny.net. Keep the code. Make it yours.</p></div>${external(publicLinks.bunnyAffiliate,'Deploy with Bunny.net','button')}</aside><script src="/demo/assets/demo.js" defer></script>`));return;}
  send(res,404,'Not found');
 };
}
module.exports={createDemo,hashPassword};
