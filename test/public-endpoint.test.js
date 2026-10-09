import test from "node:test";
import assert from "node:assert/strict";
import {parseEndpoint,reviewCacheHeaders,isEngineIOHandshake,auditEndpoint} from "../src/acceptance/public-endpoint.js";

const handshake='0'+JSON.stringify({sid:"abc",upgrades:["websocket"],pingInterval:25000,pingTimeout:20000});
class TestWebSocket extends EventTarget {
  constructor() { super(); queueMicrotask(() => this.dispatchEvent(new MessageEvent("message",{data:handshake}))); }
  close() {}
}
test("requires https and no embedded credentials",()=>{
  assert.equal(parseEndpoint("https://monitor.example"),"https://monitor.example");
  assert.throws(()=>parseEndpoint("http://monitor.example"),/HTTPS/);
  assert.throws(()=>parseEndpoint("https://user:pass@monitor.example"),/user info/);
  assert.throws(()=>parseEndpoint("https://monitor.example/?token=secret"),/query/);
  assert.equal(parseEndpoint("http://127.0.0.1:3001",{allowLocalHttp:true}),"http://127.0.0.1:3001");
});
test("cache policy rejects shared cache exposure",()=>{
  assert.equal(reviewCacheHeaders(new Headers({"cache-control":"private, no-store"})).safe,true);
  assert.equal(reviewCacheHeaders(new Headers({"cache-control":"public, max-age=3600"})).safe,false);
  assert.equal(reviewCacheHeaders(new Headers({"cache-control":"no-store","age":"3"})).safe,false);
  assert.equal(reviewCacheHeaders(new Headers({"cache-control":"no-store","x-cache":"HIT"})).safe,false);
  assert.equal(reviewCacheHeaders(new Headers()).safe,false);
});
test("Engine.IO handshake must contain real session fields",()=>{
  assert.equal(isEngineIOHandshake(200,handshake),true);
  assert.equal(isEngineIOHandshake(200,"<html>"),false);
  assert.equal(isEngineIOHandshake(404,handshake),false);
});
test("smoke verifies landing page plus Engine.IO without claiming cache certification",async()=>{
  const get=async url => new Response(url.includes("/socket.io/")?handshake:"Welcome",{
    status:200,headers:{"cache-control":"public, max-age=300"}
  });
  const audit=await auditEndpoint("http://localhost:3001",{allowLocalHttp:true,mode:"smoke",fetchImpl:get,WebSocketImpl:TestWebSocket});
  assert.equal(audit.pass,true);
  await assert.rejects(auditEndpoint("http://localhost:3001",{allowLocalHttp:true,fetchImpl:get}),/smoke/);
});
test("cross origin redirects are refused",async()=>{
  await assert.rejects(auditEndpoint("https://monitor.example",{
    fetchImpl:async()=>new Response("",{status:302,headers:{location:"https://evil.example/"}})
  }),/Cross-origin/);
});
