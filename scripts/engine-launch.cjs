// Optional engine supervisor: original Kuma remains the only SQLite writer.
'use strict';
const fs=require('fs'),fsp=require('fs/promises'),http=require('http'),crypto=require('crypto'),{spawn}=require('child_process'),os=require('os'),path=require('path');
const data='/app/data',app='E2quWe26NmOfL7q';let engine,stopping=false,busy=false,targetHealthy=true;const expectedStops=new Set();
const token=process.env.KUMAEDGE_OPS_TOKEN||'',recipient=process.env.KUMAEDGE_BACKUP_RECIPIENT||'';
if(Buffer.byteLength(token)<32||!/^age1[0-9a-z]{58}$/.test(recipient)){console.error('Private operations token and age recipient required');process.exit(2);}
const digest=s=>crypto.createHash('sha256').update(s).digest();const permitted=req=>crypto.timingSafeEqual(digest(req.headers['x-kumaedge-ops-token']||''),digest(token));
const cache={'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff'};
async function reset(){
 const nonce=process.env.KUMAEDGE_DISPOSABLE_RESET_NONCE;if(!nonce)return;
 if(process.env.KUMAEDGE_RESET_TARGET_APP_ID!==app||!/^[a-f0-9]{64}$/.test(nonce))throw Error('Reset authorization configuration invalid');
 const stat=await fsp.lstat(data);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Expected mounted data directory');
 const marker=path.join(data,'.kumaedge-reset-completed');let previous='';try{previous=await fsp.readFile(marker,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(previous===nonce)return;
 // Never remove the mount itself. No other path, state or infrastructure secret is touched.
 for(const name of await fsp.readdir(data))await fsp.rm(path.join(data,name),{recursive:true,force:true});
 const fd=await fsp.open(marker,'wx',0o600);try{await fd.writeFile(nonce);await fd.sync();}finally{await fd.close();}
 console.log('Authorized disposable app data reinitialized; volume retained');
}
function start(){
 engine=spawn(process.execPath,['server/server.js'],{cwd:'/app',env:process.env,stdio:'inherit'});
 const child=engine;child.once('exit',code=>{const expected=expectedStops.delete(child);if(!expected&&!stopping){console.error('Kuma engine exited');process.exit(code||1);}});
}
async function stop(){if(!engine||engine.exitCode!==null||engine.signalCode!==null)return;expectedStops.add(engine);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Engine did not stop cleanly')),45000);engine.once('exit',()=>{clearTimeout(timer);resolve();});engine.kill('SIGTERM');});}
const ops=http.createServer(async(req,res)=>{
 if(req.url==='/target'&&req.method==='GET'){res.writeHead(targetHealthy?200:503,cache);res.end('Controlled acceptance target');return;}
 if(!permitted(req)){res.writeHead(403,cache);res.end();return;}
 if(req.url==='/target/up'&&req.method==='POST'){targetHealthy=true;res.writeHead(204,cache);res.end();return;}
 if(req.url==='/target/down'&&req.method==='POST'){targetHealthy=false;res.writeHead(204,cache);res.end();return;}
 if(req.url!=='/backup'||req.method!=='POST'){res.writeHead(404,cache);res.end();return;}
 if(busy||stopping){res.writeHead(409,cache);res.end();return;}
 busy=true;let temp;
 try{
  await stop();temp=await fsp.mkdtemp(path.join(os.tmpdir(),'kumaedge-full-backup-'));await fsp.chmod(temp,0o700);const archive=path.join(temp,'volume.age');
  await new Promise((resolve,reject)=>{const child=spawn('python3',['/opt/kumaedge/volume-backup.py','backup',data,archive,recipient],{env:{...process.env,KUMAEDGE_APP_STOPPED:'yes'},stdio:'ignore'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Backup failed')));});
  if(!stopping)start();
  const sum=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(archive))sum.update(chunk);
  res.writeHead(200,{...cache,'content-type':'application/octet-stream','content-disposition':'attachment; filename="kumaedge-volume.age"','x-kumaedge-backup-sha256':sum.digest('hex'),'content-length':(await fsp.stat(archive)).size});
  await new Promise((resolve,reject)=>{const stream=fs.createReadStream(archive);stream.on('error',reject);res.once('close',()=>{stream.destroy();resolve();});res.once('finish',resolve);stream.pipe(res);});
 }catch{if(!res.headersSent)res.writeHead(503,cache);res.end();if(!stopping&&(!engine||engine.exitCode!==null||engine.signalCode!==null))start();}
 finally{if(temp)await fsp.rm(temp,{recursive:true,force:true});busy=false;}
});
ops.requestTimeout=120000;ops.headersTimeout=10000;ops.maxConnections=32;
async function shutdown(){if(stopping)return;stopping=true;ops.close();try{await stop();process.exit(0);}catch{process.exit(1);}}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
reset().then(()=>{start();ops.listen(3003,'127.0.0.1');}).catch(()=>{console.error('Engine initialization refused');process.exit(2);});
