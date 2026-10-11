#!/usr/bin/env node
/**
 * Record/check GHCR OCI digests for BOTH images in the tested publisher run.
 * GitHub artifacts are NOT signed OCI attestations.
 */
import { isDirectInvocation } from "./cli-entrypoint.mjs";
import { ghcrRootDigest } from "./ghcr-registry-http.mjs";
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

/**
 * Parse the ROOT manifest digest from the ordinary human-readable Buildx output.
 * Unlike '--format {{json .Manifest}}', this is supported by older Buildx CLIs.
 * Only unindented Name/MediaType/Digest lines before the 'Manifests:' block
 * count as the registry tag descriptor; platform-specific child digests never do.
 * Fail closed on missing, duplicate or mismatched headers.
 */
export function parseImagetoolsRootDigest(ref, output) {
  if (typeof output !== "string" || !output || typeof ref !== "string" || !ref) {
    throw Error("Missing/invalid registry inspect output");
  }
  const lines = output.split(/\r?\n/);
  const end = lines.findIndex(line => /^Manifests:\s*$/.test(line));
  const header = end === -1 ? lines : lines.slice(0, end);
  const names = header.filter(line => /^Name:\s+\S+\s*$/.test(line))
    .map(line => line.replace(/^Name:\s+/, "").trim());
  const types = header.filter(line => /^MediaType:\s+\S+\s*$/.test(line));
  const digests = header.filter(line => /^Digest:\s+\S+\s*$/.test(line))
    .map(line => line.replace(/^Digest:\s+/, "").trim());
  if (names.length !== 1 || names[0] !== ref || types.length !== 1 ||
      digests.length !== 1 || !DIGEST.test(digests[0])) {
    throw Error("Missing/ambiguous root OCI manifest digest for " + ref);
  }
  return digests[0];
}

export function inspectRegistry(ref) {
  // Never parse a platform submanifest or compute a hash of pretty-printed JSON.
  // Plain 'inspect' includes the exact root descriptor digest in its header.
  const stdout = execFileSync("docker", ["buildx", "imagetools", "inspect", ref], {
    encoding: "utf8", timeout: 45000, maxBuffer: 1024 * 1024
  });
  return JSON.stringify({ digest: parseImagetoolsRootDigest(ref, stdout) });
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

/**
 * Verify publisher root OCI evidence using only HTTPS GitHub Container Registry.
 * A strict dual-image check: never accept one good image as sufficient.
 */
export async function verifyEvidenceHttp(evidence, sha, repository, lookup = ghcrRootDigest) {
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
    if (await lookup(refs[key]) !== entry.digest) {
      throw Error("GHCR " + key + " tag digest changed since publisher evidence");
    }
  }
  return true;
}

if (isDirectInvocation(import.meta.url)) {
  const [mode, filename] = process.argv.slice(2);
  try {
    if (!["record", "verify", "verify-http"].includes(mode) || !filename) {
      throw Error("Usage: node scripts/oci-release-evidence.mjs record|verify|verify-http FILE");
    }
    const sha = process.env.IMAGE_TAG;
    const repo = process.env.GITHUB_REPOSITORY;
    if (mode === "record") {
      const evidence = recordEvidence(sha, repo);
      writeFileSync(filename, JSON.stringify(evidence, null, 2) + "\n",
        { flag: "wx", mode: 0o600 });
      process.stdout.write("Recorded publisher OCI digest evidence for " + sha + "\n");
    } else if (mode === "verify") {
      verifyEvidence(JSON.parse(readFileSync(filename, "utf8")), sha, repo);
      process.stdout.write("PASS: two OCI tags match publisher evidence for " + sha + "\n");
    } else {
      await verifyEvidenceHttp(JSON.parse(readFileSync(filename, "utf8")), sha, repo);
      process.stdout.write("PASS: two OCI tags match publisher evidence for " + sha + " (GHCR API, no Docker)\n");
    }
  } catch (error) {
    process.stderr.write("OCI release evidence FAILED: " + error.message + "\n");
    process.exitCode = 1;
  }
}
