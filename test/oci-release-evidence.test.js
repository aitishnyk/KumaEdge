import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  recordEvidence, verifyEvidence, manifestDigest
} from "../scripts/oci-release-evidence.mjs";

const sha = "f".repeat(40);
const repo = "aitishnyk/KumaEdge";
const mainDigest = "sha256:" + "a".repeat(64);
const backupDigest = "sha256:" + "b".repeat(64);
function makeInspector(change = {}) {
  return ref => JSON.stringify({ digest: ref.includes("-backup:") ?
    (change.backup ?? backupDigest) : (change.main ?? mainDigest) });
}

test("publisher records exact registry digests for both tested images", () => {
  const evidence = recordEvidence(sha, repo, makeInspector());
  assert.equal(evidence.repository, "aitishnyk/kumaedge");
  assert.equal(evidence.images.main.ref, "ghcr.io/aitishnyk/kumaedge:" + sha);
  assert.equal(evidence.images.backup.ref, "ghcr.io/aitishnyk/kumaedge-backup:" + sha);
  assert.equal(evidence.images.main.digest, mainDigest);
  assert.equal(evidence.images.backup.digest, backupDigest);
  assert.equal(verifyEvidence(evidence, sha, repo, makeInspector()), true);
});

test("retargeting either GHCR tag makes deployment fail closed", () => {
  const evidence = recordEvidence(sha, repo, makeInspector());
  assert.throws(() => verifyEvidence(evidence, sha, repo,
    makeInspector({main:"sha256:"+"c".repeat(64)})), /digest changed/);
  assert.throws(() => verifyEvidence(evidence, sha, repo,
    makeInspector({backup:"sha256:"+"d".repeat(64)})), /digest changed/);
});

test("bad, partial, cross-repository or stale artifact fails", () => {
  const evidence = recordEvidence(sha, repo, makeInspector());
  assert.throws(() => verifyEvidence(evidence, "e".repeat(40), repo, makeInspector()), /wrong schema/);
  assert.throws(() => verifyEvidence(evidence, sha, "other/repo", makeInspector()), /wrong schema/);
  assert.throws(() => verifyEvidence({...evidence, schema:"bad"},sha,repo,makeInspector()),/wrong schema/);
  assert.throws(() => verifyEvidence({...evidence, images:{main:evidence.images.main}},sha,repo,makeInspector()),/wrong schema/);
  assert.throws(() => verifyEvidence({...evidence, images:{...evidence.images, backup:{...evidence.images.backup, ref:"bad"}}},sha,repo,makeInspector()),/invalid backup/);
  assert.throws(() => recordEvidence("bad",repo,makeInspector()),/Invalid full/);
});

test("malformed or inaccessible registry data cannot count as a valid digest", () => {
  assert.throws(()=>manifestDigest("name",()=>JSON.stringify({})),/invalid registry/);
  assert.throws(()=>manifestDigest("name",()=>JSON.stringify({digest:"sha256:xyz"})),/invalid registry/);
  assert.throws(()=>manifestDigest("name",()=>"not-json"),/Unexpected token/);
  assert.throws(()=>manifestDigest("name",()=>{throw Error("network timeout");}),/network timeout/);
});

test("build uploads evidence after publishing; deploy verifies before mutation", () => {
  const build = readFileSync(".github/workflows/bunny-managed-image.yml", "utf8");
  const deploy = readFileSync(".github/workflows/deploy-managed.yml", "utf8");
  const publish=build.indexOf("Tag and publish the EXACT tested image");
  const record=build.indexOf("Record published OCI manifest digests");
  const upload=build.indexOf("Upload publisher digest evidence");
  assert.ok(publish>=0 && publish<record && record<upload);
  assert.match(build,/steps.image_guard.outputs.publish == 'true'/);
  assert.match(build,/retention-days: 90/);
  const attest=deploy.indexOf("Require a successful official main publishing run for the exact SHA");
  const fetch=deploy.indexOf("Download publisher digest evidence");
  const compare=deploy.indexOf("Verify OCI tags match the published digest evidence");
  const summary=deploy.indexOf("Summarize read-only release checks");
  assert.ok(attest>=0 && attest<fetch && fetch<compare && compare<summary);
  assert.doesNotMatch(deploy,/secrets\.BUNNYNET_API_KEY|container-update-image/);
});

test("Docker Hub pull authentication precedes both pinned upstream builds", () => {
  const workflow = readFileSync(".github/workflows/bunny-managed-image.yml", "utf8");
  const auth = workflow.indexOf("Authenticate pinned upstream pulls to Docker Hub when configured");
  const main = workflow.indexOf("Pull and build upstream runtime");
  const backup = workflow.indexOf("Build optional encrypted backup sidecar");
  assert.ok(auth >= 0 && auth < main && main < backup);
  assert.match(workflow,/docker login docker.io --username "\$DOCKERHUB_USERNAME" --password-stdin/);
  assert.match(workflow,/secrets.DOCKERHUB_USERNAME/);
  assert.match(workflow,/secrets.DOCKERHUB_TOKEN/);
  assert.match(workflow,/Configure both DOCKERHUB_USERNAME and DOCKERHUB_TOKEN/);
  assert.match(workflow,/docker build --pull -t kumaedge:smoke/);
  assert.match(workflow,/docker build --pull -f Dockerfile.backup/);
});
