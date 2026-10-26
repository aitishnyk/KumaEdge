// Real upstream TCP monitor implementation against controlled TLS/STARTTLS servers.
const {TCPMonitorType}=require('./server/monitor-types/tcp');
const tls=require('tls'),net=require('net'),fs=require('fs'),assert=require('assert/strict');
const options={key:fs.readFileSync('/fixtures/key.pem'),cert:fs.readFileSync('/fixtures/cert.pem')};
const context=tls.createSecureContext(options);
const secure=tls.createServer(options,s=>s.end());secure.on('tlsClientError',()=>{});
const starttls=net.createServer(s=>{
 s.write('220 localhost ESMTP\r\n');
 const listener=b=>{const line=b.toString().toUpperCase();if(line.startsWith('EHLO'))s.write('250-localhost\r\n250-STARTTLS\r\n250 SIZE 1000000\r\n');else if(line.startsWith('STARTTLS')){s.removeListener('data',listener);s.write('220 Ready to start TLS\r\n',()=>{const t=new tls.TLSSocket(s,{isServer:true,secureContext:context});t.on('error',()=>{});});}else if(line.startsWith('QUIT'))s.end('221 Bye\r\n');};s.on('data',listener);s.on('error',()=>{});
});
const listen=(s,p)=>new Promise(r=>s.listen(p,'127.0.0.1',r));
async function main(){
 await listen(secure,18443);await listen(starttls,18587);
 const monitor={name:'controlled TLS',hostname:'localhost',port:18443,smtpSecurity:'secure',expected_tls_alert:'none',isEnabledExpiryNotification:()=>true,handleTlsInfo:async()=>{}};
 const engine=new TCPMonitorType();
 if(process.env.EXPECT_UNTRUSTED==='yes'){
  await assert.rejects(()=>engine.check(monitor,{}),/self.signed certificate/);
  console.log('PASS: untrusted certificate rejected; upstream #8019 reproduced (legacy compatibility unresolved)');
 }else{
  const heartbeat={};await engine.check(monitor,heartbeat);assert.equal(heartbeat.status,1);
  monitor.port=18587;monitor.smtpSecurity='starttls';const hb={};await engine.check(monitor,hb);assert.equal(hb.status,1);
  console.log('PASS: trusted TLS and STARTTLS through real upstream TCP implementation');
 }
}
main().then(()=>process.exit(0)).catch(e=>{console.error('FAIL:',e.message);process.exit(1);});
