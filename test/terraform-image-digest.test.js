import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(path,"utf8");

test("both Bunny Terraform variants accept validated optional OCI digest", () => {
  for (const root of ["infra/bunny","infra/bunny-with-backup"]) {
    const main = read(root+"/main.tf"), vars=read(root+"/variables.tf");
    assert.match(main,/image_digest\s+= var\.image_digest == "" \? null : var\.image_digest/);
    assert.match(main,/image_tag\s+= var\.image_tag/);
    assert.match(vars,/variable "image_digest"/);
    assert.match(vars,/\^sha256:\[0-9a-f\]\{64\}\$/);
  }
});

test("backup Terraform root rejects partial main/backup digest pinning",()=>{
  const main=read("infra/bunny-with-backup/main.tf");
  const vars=read("infra/bunny-with-backup/variables.tf");
  assert.match(main,/image_digest\s+= var\.backup_image_digest == "" \? null : var\.backup_image_digest/);
  assert.match(main,/var\.image_digest == "" && var\.backup_image_digest == ""/);
  assert.match(main,/var\.image_digest != "" && var\.backup_image_digest != ""/);
  assert.match(main,/Pin both main and backup image digests together/);
  assert.match(vars,/variable "backup_image_digest"/);
  assert.match(main,/path = "\/app\/data"/);
  assert.match(main,/path = "\/data"/);
});

test("new-install docs and modules do not hard-code a real OCI digest",()=>{
  for(const path of ["infra/bunny/main.tf","infra/bunny-with-backup/main.tf","docs/BUNNY_TERRAFORM.md"]){
    assert.doesNotMatch(read(path),/sha256:[0-9a-f]{64}/);
  }
});
