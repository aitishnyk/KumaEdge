import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("upstream digest watcher is review-only, validated, and has Issue fallback",()=>{
  const script=readFileSync("scripts/watch-upstream-image.sh","utf8");
  const syntax=spawnSync("bash",["-n","scripts/watch-upstream-image.sh"],{encoding:"utf8"});
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(script,/docker buildx imagetools inspect/);
  assert.match(script,/sha256:\[a-f0-9\]\{64\}/);
  assert.match(script,/gh pr create/);
  assert.match(script,/gh issue create/);
  assert.match(script,/git switch -c/);
  assert.doesNotMatch(script,/gh pr merge|terraform apply|container-update-image|docker push/);
});

test("upstream image review workflow never reads Bunny credentials",()=>{
  const workflow=readFileSync(".github/workflows/upstream-image-watch.yml","utf8");
  assert.match(workflow,/scripts\/watch-upstream-image\.sh/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/pull-requests: write/);
  assert.match(workflow,/issues: write/);
  assert.doesNotMatch(workflow,/BUNNYNET_API_KEY|BUNNY_MC_APP_ID/);
});
