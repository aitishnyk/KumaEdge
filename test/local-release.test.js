import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("private local release preflight verifies published GHCR evidence without Bunny key",()=>{
  const s=readFileSync("scripts/check-local-release.sh","utf8");
  assert.match(s,/CI:-/);
  assert.match(s,/! -t 0/);
  assert.match(s,/scripts\/verify-release-provenance\.mjs/);
  assert.match(s,/scripts\/oci-release-evidence\.mjs/);
  assert.match(s,/kumaedge-oci-digests-\$sha/);
  assert.match(s,/--password-stdin/);
  assert.match(s,/chmod 0700 "\$private\/docker"/);
  assert.match(s,/rm -rf -- "\$private"/);
  assert.doesNotMatch(s,/BUNNYNET_API_KEY|terraform apply|container-update-image|curl.*api\.bunny/);
});
