import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recordEvidence } from "../scripts/oci-release-evidence.mjs";
import { preflightPinnedInstall } from "../scripts/preflight-bunny-install.mjs";

const sha = "8".repeat(40);
const repository = "aitishnyk/kumaedge";
const mainDigest = "sha256:" + "a".repeat(64);
const backupDigest = "sha256:" + "b".repeat(64);
const inspect = ref => JSON.stringify({digest:ref.includes("-backup:") ? backupDigest : mainDigest});
const evidence = recordEvidence(sha, repository, inspect);
const base = {sha, repository, mainDigest, evidencePath:"/private/evidence.json"};
const options = {read:() => JSON.stringify(evidence), inspect};

test("verified, digest-pinned single-container install passes without touching Bunny", () => {
  assert.deepEqual(preflightPinnedInstall(base, options), {verified:true,mode:"pinned-main",sha});
});

test("paired backup-mode pins need the same publisher evidence", () => {
  assert.equal(preflightPinnedInstall({...base,backupMode:true,backupDigest},options).mode,"pinned-pair");
  assert.throws(()=>preflightPinnedInstall({...base,backupMode:true},options),/require BOTH/);
  assert.throws(()=>preflightPinnedInstall({...base,mainDigest:"",backupMode:true,backupDigest},options),/require BOTH/);
  assert.throws(()=>preflightPinnedInstall({...base,backupDigest},options),/without backup/);
});

test("different publisher or bad tags, digests and evidence fail closed", () => {
  assert.throws(()=>preflightPinnedInstall({...base,sha:"bad"},options),/40-character/);
  assert.throws(()=>preflightPinnedInstall({...base,repository:"evil:wrong"},options),/Invalid GHCR/);
  assert.throws(()=>preflightPinnedInstall({...base,mainDigest:"sha256:not-a-digest"},options),/Invalid main/);
  assert.throws(()=>preflightPinnedInstall({...base,evidencePath:""},options),/evidence.json is required/);
  assert.throws(()=>preflightPinnedInstall(base,{...options,read:()=>"{broken"}),/malformed/);
  assert.throws(()=>preflightPinnedInstall(base,{...options,read:()=>JSON.stringify({...evidence,sha:"0".repeat(40)})}),/wrong schema, SHA/);
  assert.throws(()=>preflightPinnedInstall({...base,mainDigest:"sha256:"+"c".repeat(64)},options),/Main Terraform digest/);
  assert.throws(()=>preflightPinnedInstall({...base,backupMode:true,backupDigest:"sha256:"+"c".repeat(64)},options),/Backup Terraform digest/);
});

test("retargeted or inaccessible GHCR image prevents a pinned install", () => {
  assert.throws(()=>preflightPinnedInstall(base,{
    ...options,inspect:ref=>JSON.stringify({digest:ref.includes("-backup:")?backupDigest:"sha256:"+"c".repeat(64)})
  }),/digest changed/);
  assert.throws(()=>preflightPinnedInstall(base,{
    ...options,inspect:()=>{throw Error("registry HTTP 403");}
  }),/registry HTTP 403/);
});

test("tag-only install is not misrepresented as publisher-verified", () => {
  assert.deepEqual(preflightPinnedInstall({...base,mainDigest:"",evidencePath:""},options),
    {verified:false,mode:"tag-only",sha});
});

test("interactive installer checks OCI evidence before paid plan and uses ephemeral Docker login", () => {
  const installer=readFileSync("scripts/install-bunny.sh","utf8");
  const verify=installer.indexOf("scripts/preflight-bunny-install.mjs");
  const plan=installer.indexOf("terraform plan -input=false");
  assert.ok(verify>0 && plan>verify);
  assert.match(installer,/KUMAEDGE_RELEASE_EVIDENCE_FILE/);
  assert.match(installer,/docker --config "\$release_docker_config" login ghcr.io/);
  assert.match(installer,/--password-stdin/);
  assert.match(installer,/rm -rf -- "\$release_docker_config"/);
  assert.match(installer,/DOCKER_CONFIG="\$release_docker_config"/);
  assert.match(installer,/CREATE KUMAEDGE/);
  assert.doesNotMatch(installer,/terraform apply[^\n]*-auto-approve/);
});
