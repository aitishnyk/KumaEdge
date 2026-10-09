import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("disaster recovery script passes Bash syntax and is isolated from Bunny",()=>{
  const check=spawnSync("bash",["-n","scripts/smoke-disaster-recovery.sh"],{encoding:"utf8"});
  assert.equal(check.status,0,check.stderr);
  const source=readFileSync("scripts/smoke-disaster-recovery.sh","utf8");
  const workflow=readFileSync(".github/workflows/bunny-managed-image.yml","utf8");
  for(const value of ["docker volume create","docker volume rm",
     "KUMAEDGE_APP_STOPPED=yes","volume-backup.py backup",
     "volume-backup.py verify","volume-backup.py restore",
     "kuma.db","diff -qr","smoke --allow-local-http"]) {
     assert.ok(source.includes(value), "missing DR gate "+value);
  }
  assert.match(workflow,/smoke-disaster-recovery\.sh kumaedge:smoke/);
  assert.ok(workflow.indexOf("Encrypted offline full-volume recovery") <
            workflow.indexOf("Tag and publish the EXACT tested image"));
  assert.doesNotMatch(source,/BUNNYNET_API_KEY|BUNNY_MC_APP_ID|terraform apply|docker push/);
});
