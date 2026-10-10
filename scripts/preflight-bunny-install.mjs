#!/usr/bin/env node
/**
 * Fail-closed, read-only preflight for opt-in digest-pinned Bunny installs.
 * Requires publisher evidence artifact and compares both CURRENT GHCR digests.
 * Does NOT call Bunny, create resources, or authenticate to GitHub.
 */
import { readFileSync } from "node:fs";
import { verifyEvidence, inspectRegistry } from "./oci-release-evidence.mjs";

const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REPO = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/;

export function preflightPinnedInstall({
  sha, repository, mainDigest = "", backupDigest = "",
  backupMode = false, evidencePath = ""
}, { read = readFileSync, inspect = inspectRegistry } = {}) {
  if (!SHA.test(sha || "")) throw Error("A published lowercase 40-character Git SHA is required");
  if (!REPO.test((repository || "").toLowerCase())) throw Error("Invalid GHCR image repository");
  if (!["", undefined].includes(mainDigest) && !DIGEST.test(mainDigest)) {
    throw Error("Invalid main OCI digest pin");
  }
  if (!["", undefined].includes(backupDigest) && !DIGEST.test(backupDigest)) {
    throw Error("Invalid backup OCI digest pin");
  }
  if (backupMode && Boolean(mainDigest) !== Boolean(backupDigest)) {
    throw Error("Backup installs require BOTH OCI digest pins or neither");
  }
  if (!backupMode && backupDigest) {
    throw Error("Backup OCI digest pin supplied for an install without backup");
  }
  if (!mainDigest && !backupDigest) {
    return { verified: false, mode: "tag-only", sha };
  }
  if (!evidencePath) throw Error("Publisher evidence.json is required for OCI digest pins");

  let evidence;
  try {
    evidence = JSON.parse(read(evidencePath, "utf8"));
  } catch {
    throw Error("Publisher evidence.json cannot be read or is malformed");
  }
  verifyEvidence(evidence, sha, repository, inspect);
  if (evidence.images.main.digest !== mainDigest) {
    throw Error("Main Terraform digest pin differs from publisher evidence");
  }
  if (backupMode && evidence.images.backup.digest !== backupDigest) {
    throw Error("Backup Terraform digest pin differs from publisher evidence");
  }
  return { verified: true, mode: backupMode ? "pinned-pair" : "pinned-main", sha };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  try {
    const result = preflightPinnedInstall({
      sha: process.env.TF_VAR_image_tag,
      repository: process.env.KUMAEDGE_GHCR_REPOSITORY,
      mainDigest: process.env.TF_VAR_image_digest || "",
      backupDigest: process.env.TF_VAR_backup_image_digest || "",
      backupMode: process.env.KUMAEDGE_BACKUP_MODE === "true",
      evidencePath: process.argv[2] || ""
    });
    if (!result.verified) throw Error("Refusing to describe an unpinned install as digest-verified");
    process.stdout.write("PASS: publisher evidence, two GHCR manifests and Terraform OCI pins match for " + result.sha + "\n");
  } catch (error) {
    process.stderr.write("Bunny image pin preflight FAILED: " + error.message + "\n");
    process.exitCode = 1;
  }
}
