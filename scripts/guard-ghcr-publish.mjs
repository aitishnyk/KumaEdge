#!/usr/bin/env node
/** Fail closed on registry errors; only an unambiguous missing manifest is absent. */
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export function classifyManifest(result) {
  if (result?.error || typeof result?.status !== "number") {
    throw Error("Registry inspection did not return a valid process result");
  }
  if (result.status === 0) return "present";
  const stderr = (result.stderr || "").trim();
  if (/^no such manifest(?:\s|:)/i.test(stderr) ||
      /^manifest unknown(?:\s|:)/i.test(stderr)) {
    return "missing";
  }
  throw Error("Cannot determine manifest presence safely; refuse release");
}

export function planImagePublish(main, backup) {
  if (!["present", "missing"].includes(main) || !["present", "missing"].includes(backup)) {
    throw Error("Unknown registry state");
  }
  if (main === "present" && backup === "present") return "skip";
  if (main === "missing" && backup === "missing") return "publish";
  throw Error("Only one of two release images exists; refuse overwriting any SHA tag");
}

export function inspectImage(name, inspect = spawnSync) {
  const result = inspect("docker", ["manifest", "inspect", name], {
    encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024
  });
  return classifyManifest(result);
}

export function guardRelease(repoName, sha, {
  inspect = spawnSync,
  outputFile = process.env.GITHUB_OUTPUT
} = {}) {
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(repoName || "") ||
      !/^[a-f0-9]{40}$/.test(sha || "")) throw Error("Invalid repository name or image SHA");
  if (!outputFile) throw Error("GITHUB_OUTPUT is required");
  const ref = "ghcr.io/" + repoName + ":" + sha;
  const second = "ghcr.io/" + repoName + "-backup:" + sha;
  const mode = planImagePublish(inspectImage(ref, inspect), inspectImage(second, inspect));
  appendFileSync(outputFile, "publish=" + (mode === "publish" ? "true" : "false") + "\n");
  return mode;
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  try {
    const mode = guardRelease((process.env.GITHUB_REPOSITORY || "").toLowerCase(),
      process.env.GITHUB_SHA);
    process.stdout.write("GHCR release publication guard: " + mode + "\n");
  } catch (error) {
    process.stderr.write("GHCR release blocked: " + error.message + "\n");
    process.exitCode = 1;
  }
}
