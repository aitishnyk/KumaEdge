#!/usr/bin/env node
/** Fail closed on registry errors; only an unambiguous missing manifest is absent. */
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

export function classifyManifest(result) {
  if (result?.error || typeof result?.status !== "number") {
    throw Error("Registry inspection did not return a valid process result");
  }
  if (result.status === 0) return "present";
  const stderr = (result.stderr || "").replace(/\x1b\[[0-9;]*m/g, "").trim();
  // GHCR and Docker wrap an absent manifest in several diagnostic prefixes,
  // including "Error response from daemon: manifest unknown: manifest unknown".
  // An explicit missing-manifest reason is safe ONLY if no authentication,
  // network or rate-limiting failure appears anywhere in the diagnostic.
  const unsafe = /\b(?:unauthorized|unauthenticated|denied|forbidden|authentication|access denied|timeout|timed out|connection|network|deadline|rate.limit|too many requests|tls|x509|401|403|429|500|502|503|504)\b/i;
  const missing = /\b(?:no such manifest|manifest unknown|MANIFEST_UNKNOWN)\b/i;
  if (missing.test(stderr) && !unsafe.test(stderr)) return "missing";
  // Never print arbitrary raw Docker output or a token-bearing URL to Actions.
  const hint = (stderr.split(/\r?\n/).find(Boolean) || "no diagnostic")
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/\b(?:bearer|token|password|secret|authorization)[=: ]+\S+/gi, "[credential]")
    .replace(/[A-Za-z0-9+/=_-]{40,}/g, "[data]")
    .slice(0, 180);
  throw Error("Cannot determine manifest presence safely; refuse release" +
    " (exit " + result.status + ", Docker: " + hint + ")");
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
