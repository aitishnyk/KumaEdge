import test from "node:test";
import assert from "node:assert/strict";
import { auditEndpoint, auditWebSocket, parseEndpoint, readBoundedText } from "../src/acceptance/public-endpoint.js";
const opening = "0" + JSON.stringify({ sid: "sid", pingInterval: 25000, pingTimeout: 20000 });
class SuccessWS extends EventTarget {
  static url;
  constructor(url) {
    super();
    SuccessWS.url = url;
    queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: opening })));
  }
  close() {}
}
class BrokenWS extends EventTarget {
  constructor() {
    super();
    queueMicrotask(() => this.dispatchEvent(new Event("error")));
  }
  close() {}
}
const goodHeaders = { "cache-control": "private, no-store", "content-type": "text/plain" };
const createFetch = (overrides = {}) => async (url) => {
  if (url.includes("socket.io")) return new Response(overrides.pollingBody ?? opening, {
    status: 200,
    headers: overrides.pollingHeaders ?? goodHeaders
  });
  return new Response("<html>login</html>", {
    status: 200,
    headers: overrides.htmlHeaders ?? goodHeaders
  });
};

test("real WebSocket opening packet is checked and URL uses secure transport", async () => {
  assert.equal(await auditWebSocket("https://monitor.example", { WebSocketImpl: SuccessWS }), "pass");
  assert.match(SuccessWS.url, /^wss:\/\/monitor\.example\/socket\.io\//);
  await assert.rejects(auditWebSocket("https://monitor.example", { WebSocketImpl: BrokenWS }), /connection error/);
});
test("production checks HTML, Engine.IO polling, and real WebSocket", async () => {
  const report = await auditEndpoint("https://monitor.example", {
    fetchImpl: createFetch(), WebSocketImpl: SuccessWS
  });
  assert.equal(report.websocket, "pass");
  assert.equal(report.pollingCache.safe, true);
  await assert.rejects(auditEndpoint("https://monitor.example", {
    fetchImpl: createFetch({ pollingHeaders: { "cache-control": "public, max-age=3600" } }),
    WebSocketImpl: SuccessWS
  }), /polling cache policy/);
});
test("HTTP smoke bypass cannot be enabled for production", async () => {
  await assert.rejects(auditEndpoint("http://localhost:3001", {
    allowLocalHttp: true, mode: "production", fetchImpl: createFetch(), WebSocketImpl: SuccessWS
  }), /only permitted in smoke/);
  const smoke = await auditEndpoint("http://localhost:3001", {
    allowLocalHttp: true, mode: "smoke", fetchImpl: createFetch(), WebSocketImpl: SuccessWS
  });
  assert.equal(smoke.pass, true);
});
test("oversized and malformed Engine.IO response is rejected", async () => {
  await assert.rejects(readBoundedText(new Response("x".repeat(10000))), /oversized/);
  await assert.rejects(auditEndpoint("https://monitor.example", {
    fetchImpl: createFetch({ pollingBody: "<html>not a handshake</html>" }),
    WebSocketImpl: SuccessWS
  }), /polling handshake failed/);
});
test("an endpoint URL cannot silently contain subpaths", () => {
  assert.throws(() => parseEndpoint("https://monitor.example/subpath"), /without a subpath/);
});
