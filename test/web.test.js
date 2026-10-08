import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("static dashboard assets and Bunny entrypoint present", () => {
  const html = readFileSync("web/index.html", "utf8");
  assert.match(html, /styles\.css/);
  assert.match(html, /app\.js/);
  const edge = readFileSync("edge/script.ts", "utf8");
  assert.match(edge, /BunnySDK\.net\.http\.serve/);
  assert.match(edge, /redirect: "manual"/);
  assert.doesNotMatch(edge, /searchParams\.get\("url"\)/);
});
