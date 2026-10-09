import test from "node:test";
import assert from "node:assert/strict";
import { reviewHsts, auditEndpoint } from "../src/acceptance/public-endpoint.js";

const handshake = "0"+JSON.stringify({sid:"session",pingInterval:25000,pingTimeout:20000});
class TestWS extends EventTarget {
  constructor() { super(); queueMicrotask(() => this.dispatchEvent(new MessageEvent("message",{data:handshake}))); }
  close() {}
}
const source = (hsts) => async (url) => new Response(url.includes("socket.io") ? handshake : "<html>working</html>",{
  headers: {
    "cache-control": "private, no-store",
    ...(hsts ? {"strict-transport-security":hsts} : {}),
  }
});
test("strong HSTS accepted; missing or weak HSTS rejected",async()=>{
  const strong="max-age=31536000";
  const a=await auditEndpoint("https://example.org",{fetchImpl:source(strong),WebSocketImpl:TestWS,requireHsts:true});
  assert.equal(a.hsts.strong,true);
  await assert.rejects(auditEndpoint("https://example.org",{fetchImpl:source("max-age=1234"),WebSocketImpl:TestWS,requireHsts:true}),/HSTS/);
  await assert.rejects(auditEndpoint("https://example.org",{fetchImpl:source(null),WebSocketImpl:TestWS,requireHsts:true}),/HSTS/);
});
test("HSTS report is honest, optional and not a substitute for cache checks",async()=>{
  const a=await auditEndpoint("https://example.org",{fetchImpl:source(null),WebSocketImpl:TestWS});
  assert.equal(a.pass,true);
  assert.equal(a.hsts.present,false);
  const hdr=new Headers({"strict-transport-security":"max-age=31536000; includeSubDomains"});
  assert.equal(reviewHsts(hdr).strong,true);
  hdr.set("strict-transport-security","max-age=0");
  assert.equal(reviewHsts(hdr).strong,false);
});
