import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(x=>x.endsWith('.md'));let checked=0;const errors=[];
for(const file of files){
 if(file.startsWith('docs/legacy')||file.startsWith('docs/releases/'))continue;
 const source=fs.readFileSync(file,'utf8');
 for(const m of source.matchAll(/(?:!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)|(?:src|href)="([^"]+)")/g)){
  let target=m[1]||m[2];if(/^(?:https?:|mailto:|#)/.test(target)||target.includes('<'))continue;
  target=decodeURIComponent(target.split('#')[0]);if(!target)continue;checked++;
  if(!fs.existsSync(path.resolve(path.dirname(file),target)))errors.push(file+': '+target);
 }
}
for(const file of ['demo-desktop.jpg','demo-mobile.jpg','demo-login.jpg','owner-dashboard.jpg','status-page.jpg']){const p='docs/assets/screenshots/'+file;if(!fs.existsSync(p)||fs.statSync(p).size>1000000)errors.push('Missing/oversized screenshot '+p);else if(fs.readFileSync(p).subarray(0,3).toString('hex')!=='ffd8ff')errors.push('Not JPEG '+p);}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('PASS Markdown relative links and real screenshot assets: '+checked+' links');
