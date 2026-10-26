import test from 'node:test';import assert from 'node:assert/strict';import {checkGateway} from '../scripts/check-gateway.mjs';
test('public gateway probe expects protected Socket.IO and rejects exposed owner/cache',async()=>{
 const good=async url=>new Response('',{status:url.endsWith('/healthz')?200:401,headers:{'cache-control':'private, no-store'}});
 assert.equal((await checkGateway('https://demo.example',{fetchImpl:good})).publicOwnerGate,'PASS');
 await assert.rejects(checkGateway('https://demo.example',{fetchImpl:async()=>new Response('',{status:200})}));
 await assert.rejects(checkGateway('http://demo.example',{fetchImpl:good}));
 await assert.rejects(checkGateway('https://demo.example',{fetchImpl:async url=>new Response('',{status:url.endsWith('/healthz')?200:401,headers:{'cache-control':'public, max-age=60'}})}));
});
