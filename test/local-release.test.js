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
  assert.match(s,/export GHCR_USERNAME/);
  assert.match(s,/verify-http/);
  assert.match(s,/rm -rf -- "\$private"/);
  assert.doesNotMatch(s,/BUNNYNET_API_KEY|terraform apply|container-update-image|curl.*api\.bunny/);
});

test("local release preflight rejects silent or malformed publisher output",()=>{
  const s=readFileSync("scripts/check-local-release.sh","utf8");
  assert.match(s,/Publisher proof CLI returned no run_id/);
  assert.match(s,/Publisher proof CLI returned an invalid run_id format/);
  assert.match(s,/run_id=\(\[0-9\]\+\)/);
});

test("local release uses OCI root manifest verifier without unsupported CLI formatting",()=>{
  const s=readFileSync("scripts/oci-release-evidence.mjs","utf8");
  assert.match(s,/parseImagetoolsRootDigest/);
  assert.match(s,/verifyEvidenceHttp/);
  assert.match(s,/ghcrRootDigest/);
  assert.doesNotMatch(s, /"--format"/);
});

test("Mac GHCR verification works without Docker or Buildx and still cleans up credentials",()=>{
  const s=readFileSync("scripts/check-local-release.sh","utf8");
  assert.doesNotMatch(s,/docker buildx|docker login|docker --config|DOCKER_CONFIG/);
  assert.match(s,/verify-http/);
  assert.match(s,/GITHUB_TOKEN/);
  assert.match(s,/rm -rf -- "\$private"/);
});
