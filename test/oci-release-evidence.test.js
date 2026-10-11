import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, chmodSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  recordEvidence, verifyEvidence, manifestDigest, parseImagetoolsRootDigest
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

test("Docker Buildx plain inspect extracts only the ROOT OCI digest", () => {
  const ref = "ghcr.io/aitishnyk/kumaedge:" + sha;
  const child = "sha256:" + "f".repeat(64);
  const output = [
    "Name:      " + ref,
    "MediaType: application/vnd.oci.image.index.v1+json",
    "Digest:    " + mainDigest,
    "",
    "Manifests:",
    "  Name:      " + ref + "@" + child,
    "  MediaType: application/vnd.oci.image.manifest.v1+json",
    "  Digest:    " + child,
    "  Platform:  linux/amd64",
    ""
  ].join("\n");
  assert.equal(parseImagetoolsRootDigest(ref, output), mainDigest);
  assert.equal(parseImagetoolsRootDigest(ref, output.replaceAll("\n", "\r\n")), mainDigest);
  assert.equal(parseImagetoolsRootDigest(ref,
    ["Name:      " + ref, "MediaType: application/vnd.oci.image.manifest.v1+json",
      "Digest:    " + mainDigest].join("\n")), mainDigest);
  const source = readFileSync("scripts/oci-release-evidence.mjs", "utf8");
  assert.match(source, /\["buildx", "imagetools", "inspect", ref\]/);
  assert.doesNotMatch(source, /"--format"|--raw/);
});

test("plain Buildx parser refuses child-only, mismatched or ambiguous root digest", () => {
  const ref = "ghcr.io/aitishnyk/kumaedge:" + sha;
  const good = "Name: " + ref + "\nMediaType: application/vnd.oci.image.index.v1+json\nDigest: " + mainDigest + "\n";
  for (const sample of [
    "",
    "{}",
    "Manifests:\n  Name: " + ref + "\n  Digest: " + mainDigest,
    good.replace("Digest: " + mainDigest + "\n", ""),
    good.replace(ref, ref + "-not-same"),
    good + "Digest: " + backupDigest + "\n",
    good.replace("MediaType: application/vnd.oci.image.index.v1+json\n", ""),
    good.replace(mainDigest, "sha256:invalid"),
    good.replace("Name: " + ref, "Name: " + ref + "\nName: " + ref)
  ]) {
    assert.throws(() => parseImagetoolsRootDigest(ref, sample),
      /Missing|ambiguous|invalid/, "Unexpectedly accepted: " + sample);
  }
});

test("CLI accepts old Buildx plain inspect and rejects tag retargeting", () => {
  const dir = mkdtempSync(join(tmpdir(), "kumaedge-plain-buildx-"));
  const docker = join(dir, "docker");
  const artifact = join(dir, "evidence.json");
  try {
    const script = [
      "#!/bin/sh",
      'test "$#" -eq 4 || exit 31',
      'test "$1" = buildx && test "$2" = imagetools && test "$3" = inspect || exit 32',
      'case "$4" in',
      '  *-backup:*) selected="sha256:' + "b".repeat(64) + '";;',
      '  *) selected="sha256:' + "a".repeat(64) + '";;',
      'esac',
      'if test "$KUMAEDGE_TEST_RETARGET" = 1; then',
      '  case "$4" in *-backup:*) selected="sha256:' + "c".repeat(64) + '";; esac',
      'fi',
      "printf 'Name: %s\\nMediaType: application/vnd.oci.image.index.v1+json\\nDigest: %s\\n\\nManifests:\\n  Name: %s@sha256:" + "d".repeat(64) + "\\n' \"$4\" \"$selected\" \"$4\"",
    ].join("\n") + "\n";
    writeFileSync(docker, script, {mode: 0o700});
    chmodSync(docker, 0o700);
    writeFileSync(artifact, JSON.stringify(recordEvidence(sha, repo, makeInspector())));
    const env = {
      ...process.env,
      PATH: dir + ":" + process.env.PATH,
      IMAGE_TAG: sha,
      GITHUB_REPOSITORY: repo,
      KUMAEDGE_TEST_RETARGET: "0"
    };
    const command = ["scripts/oci-release-evidence.mjs", "verify", artifact];
    const verified = spawnSync(process.execPath, command, {encoding:"utf8", env, timeout:20000});
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /PASS: two OCI tags match publisher evidence/);
    const retargeted = spawnSync(process.execPath, command, {
      encoding:"utf8", env:{...env,KUMAEDGE_TEST_RETARGET:"1"}, timeout:20000
    });
    assert.equal(retargeted.status, 1, retargeted.stdout + retargeted.stderr);
    assert.match(retargeted.stderr, /backup tag digest changed/);
  } finally {
    rmSync(dir,{recursive:true,force:true});
  }
});
