import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const dockerfile=readFileSync("Dockerfile","utf8");
const worker=readFileSync("Dockerfile.backup","utf8");
const workflow=readFileSync(".github/workflows/bunny-managed-image.yml","utf8");

test("pinned upstream image digest",()=>{
  assert.match(dockerfile,/^FROM louislam\/uptime-kuma:2@sha256:[a-f0-9]{64}$/m);
});
test("pinned backup image digest",()=>{
  assert.match(worker,/^FROM python:3\.12-slim-bookworm@sha256:[a-f0-9]{64}$/m);
});
test("GHCR SHA tags cannot be overwritten by schedules or manual builds",()=>{
  assert.match(workflow,/Fail-closed GHCR manifest state/);
  assert.match(workflow,/node scripts\/guard-ghcr-publish\.mjs/);
  const guard=readFileSync("scripts/guard-ghcr-publish.mjs","utf8");
  assert.match(guard,/Only one of two release images exists/);
  assert.match(guard,/Cannot determine manifest presence safely/);
  assert.match(workflow,/steps.image_guard.outputs.publish == 'true'/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/schedule:/);
  const publish=workflow.slice(workflow.indexOf("      - name: Tag and publish"));
  assert.match(publish,/github.event_name == 'push'/);
  assert.doesNotMatch(publish,/workflow_dispatch/);
});
