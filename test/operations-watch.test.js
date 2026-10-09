import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditEndpoint, parseEndpoint } from "../src/acceptance/public-endpoint.js";

test("production audit blocks private and loopback IP literals without network requests", async () => {
  const blocked = ["https://127.0.0.1", "https://192.168.0.1", "https://10.1.1.1",
    "https://172.16.4.2", "https://[::1]", "https://localhost",
    "https://node.local", "https://status.internal", "https://example.test", "https://intranet"];
  for (const url of blocked) {
    await assert.rejects(auditEndpoint(url, {
      fetchImpl: () => { throw new Error("Unexpected network request"); }
    }), /public DNS hostname/, url);
  }
  assert.equal(parseEndpoint("https://status.example.org",{publicOnly:true}),"https://status.example.org");
  assert.equal(parseEndpoint("http://localhost:3001",{allowLocalHttp:true}),"http://localhost:3001");
});

test("external observer is opt-in and never transmits admin or Bunny credentials", () => {
  const w=readFileSync(".github/workflows/production-uptime-watch.yml","utf8");
  assert.match(w,/KUMAEDGE_PUBLIC_WATCH_ENABLED == 'true'/);
  assert.match(w,/github.event_name == 'workflow_dispatch'/);
  assert.match(w,/timeout-minutes: 3/);
  assert.match(w,/contents: read/);
  assert.match(w,/node scripts\/check-production\.mjs/);
  assert.doesNotMatch(w,/secrets\.|BUNNYNET_API_KEY|--insecure|curl -k/);
});
