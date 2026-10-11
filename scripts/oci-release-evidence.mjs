#!/usr/bin/env node
/**
 * Record/check GHCR OCI digests for BOTH images in the tested publisher run.
 * GitHub artifacts are NOT signed OCI attestations.
 */
import { isDirectInvocation } from "./cli-entrypoint.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const REPO = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/;
export const SCHEMA = "kumaedge-oci-digests-v1";

function targets(sha, repository) {
  if (!SHA.test(sha || "")) throw Error("Invalid full image SHA");
  const repo = (repository || "").toLowerCase();
  if (!REPO.test(repo)) throw Error("Invalid GitHub repository");
  const root = "ghcr.io/" + repo;
  return { main: root + ":" + sha, backup: root + "-backup:" + sha };
}

export function manifestDigest(ref, inspect = inspectRegistry) {
  const payload = JSON.parse(inspect(ref));
  if (!payload || !DIGEST.test(payload.digest || "")) {
    throw Error("Missing/invalid registry manifest digest for " + ref);
  }
  return payload.digest;
}

export function inspectRegistry(ref) {
  return execFileSync("docker", ["buildx", "imagetools", "inspect", ref,
    "--format", "{{json .Manifest}}"], {
      encoding: "utf8", timeout: 45000, maxBuffer: 1024 * 1024
    });
}

export function recordEvidence(sha, repository, inspect = inspectRegistry) {
  const refs = targets(sha, repository);
  return {
    schema: SCHEMA, sha, repository: repository.toLowerCase(),
    images: {
      main: { ref: refs.main, digest: manifestDigest(refs.main, inspect) },
      backup: { ref: refs.backup, digest: manifestDigest(refs.backup, inspect) }
    }
  };
}

export function verifyEvidence(evidence, sha, repository, inspect = inspectRegistry) {
  const refs = targets(sha, repository);
  if (!evidence || evidence.schema !== SCHEMA || evidence.sha !== sha ||
      evidence.repository !== repository.toLowerCase() || !evidence.images ||
      !evidence.images.main || !evidence.images.backup) {
    throw Error("Publisher evidence has wrong schema, SHA or repository");
  }
  for (const key of ["main", "backup"]) {
    const entry = evidence.images[key];
    if (entry.ref !== refs[key] || !DIGEST.test(entry.digest || "")) {
      throw Error("Publisher evidence contains invalid " + key + " image metadata");
    }
    if (manifestDigest(refs[key], inspect) !== entry.digest) {
      throw Error("GHCR " + key + " tag digest changed since publisher evidence");
    }
  }
  return true;
}

if (isDirectInvocation(import.meta.url)) {
  const [mode, filename] = process.argv.slice(2);
  try {
    if (!["record", "verify"].includes(mode) || !filename) {
      throw Error("Usage: node scripts/oci-release-evidence.mjs record|verify FILE");
    }
    const sha = process.env.IMAGE_TAG;
    const repo = process.env.GITHUB_REPOSITORY;
    if (mode === "record") {
      const evidence = recordEvidence(sha, repo);
      writeFileSync(filename, JSON.stringify(evidence, null, 2) + "\n",
        { flag: "wx", mode: 0o600 });
      process.stdout.write("Recorded publisher OCI digest evidence for " + sha + "\n");
    } else {
      verifyEvidence(JSON.parse(readFileSync(filename, "utf8")), sha, repo);
      process.stdout.write("PASS: two OCI tags match publisher evidence for " + sha + "\n");
    }
  } catch (error) {
    process.stderr.write("OCI release evidence FAILED: " + error.message + "\n");
    process.exitCode = 1;
  }
}
