import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

test("Bunny install script passes bash syntax and has explicit paid apply consent",()=>{
  const result=spawnSync("bash",["-n","scripts/install-bunny.sh"],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr);
  const text=readFileSync("scripts/install-bunny.sh","utf8");
  assert.match(text,/CREATE KUMAEDGE/);
  assert.match(text,/! -t 0/);
  assert.match(text,/terraform plan -input=false/);
  assert.match(text,/terraform apply -input=false/);
  assert.match(text,/umask 077/);
  assert.match(text,/TF_VAR_image_tag/);
  assert.match(text,/--with-backup/);
  assert.match(text,/TF_VAR_backup_storage_access_key/);
  assert.match(text,/TF_VAR_backup_age_recipient/);
  assert.match(text,/40-character commit SHA/);
  assert.equal(text.includes(String.raw`\${`), false, "shell variables must not be escaped as literals");
  assert.doesNotMatch(text,/terraform apply[^\n]*-auto-approve/);
});
