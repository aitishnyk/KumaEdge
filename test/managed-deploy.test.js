import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("public release preflight verifies SHA, publisher and both manifests but cannot deploy",()=>{
  const w=readFileSync(".github/workflows/deploy-managed.yml","utf8");
  const sha=w.indexOf("Validate SHA is from the protected main branch");
  const release=w.indexOf("Require a successful official main publishing run");
  const registry=w.indexOf("Verify release image exists before operator approval");
  const download=w.indexOf("Download publisher digest evidence");
  const verify=w.indexOf("Verify OCI tags match the published digest evidence");
  const summary=w.indexOf("Summarize read-only release checks");
  assert.ok(sha>0&&sha<release&&release<registry&&registry<download&&download<verify&&verify<summary);
  assert.match(w,/docker manifest inspect "ghcr.io\/\$\{repo_lower\}-backup:\$TAG"/);
  assert.match(w,/scripts\/verify-release-provenance\.mjs/);
  assert.match(w,/scripts\/oci-release-evidence\.mjs verify/);
  assert.match(w,/Production dispatch must use main/);
  assert.match(w,/actions: read/);
  assert.match(w,/NO Bunny API requests, container updates or paid resource changes/);
  assert.doesNotMatch(w,/container-update-image|terraform apply|secrets\.BUNNYNET_API_KEY|api_key:/i);
});

test("Bunny metadata preflight is intentionally credential-free",()=>{
  const w=readFileSync(".github/workflows/bunny-access-preflight.yml","utf8");
  assert.match(w,/HAS_BUNNY_APP_ID/);
  assert.match(w,/GitHub never receives Bunny account API keys/);
  assert.doesNotMatch(w,/secrets\.|BUNNYNET_API_KEY|container-update-image/);
});
