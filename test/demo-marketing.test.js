import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const links=createRequire(import.meta.url)('../scripts/demo-public.cjs');
test('README affiliate showcase is generated from canonical config without link drift',()=>{
 execFileSync(process.execPath,['scripts/sync-demo-readme.cjs','--check']);const readme=fs.readFileSync('README.md','utf8');
 const homes=[...readme.matchAll(/href="(https:\/\/(?:www\.)?bunny\.net[^"\s]*)"/g)].map(match=>match[1]);assert.equal(homes.length,2);for(const href of homes)assert.equal(href,links.bunnyAffiliate);
 assert.match(readme,/Live Demo/);assert.match(readme,/affiliate link/);assert.match(readme,/docs\/assets\/screenshots\/demo-desktop.jpg/);assert.match(readme,/Try the Live Demo/);assert.match(readme,/Password/);
});
test('affiliate URL stays out of infrastructure and technical endpoints',()=>{
 for(const file of ['infra/bunny/main.tf','infra/bunny/variables.tf','scripts/local/bunny-deploy.py','scripts/local/harden-existing-cdn.py','Dockerfile','Dockerfile.backup'])assert.ok(!fs.readFileSync(file,'utf8').includes('ref=4mvi9kc9vn'),file);
});

test('all public Markdown/HTML homepage marketing URLs preserve the canonical affiliate destination',()=>{
 const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(file=>/\.(md|html)$/.test(file));
 for(const file of files){const text=fs.readFileSync(file,'utf8');for(const [href] of text.matchAll(/https?:\/\/(?:www\.)?bunny\.net[^\s"'<>`)\]]*/g)){const url=new URL(href);if(url.pathname==='/')assert.equal(href,links.bunnyAffiliate,file);}}
 assert.deepEqual(fs.readFileSync('docs/images/demo-desktop.jpg').subarray(0,3),Buffer.from([255,216,255]));
});

test('public documentation links and screenshots exist',()=>{execFileSync(process.execPath,['scripts/validate-public-docs.mjs']);});
