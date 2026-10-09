#!/usr/bin/env node
/**
 * Fail-closed GH Actions provenance gate: the exact SHA must have an official,
 * successful main-branch *push* publishing workflow run before deployment.
 * This is NOT a registry signature or a guarantee against external tag mutation.
 */
const SHA = /^[a-f0-9]{40}$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function hasSuccessfulMainRelease(payload, sha) {
  if (!SHA.test(sha) || !payload || !Array.isArray(payload.workflow_runs)) return false;
  return payload.workflow_runs.some(run =>
    run?.head_sha === sha &&
    run?.head_branch === "main" &&
    run?.event === "push" &&
    run?.status === "completed" &&
    run?.conclusion === "success"
  );
}

export async function checkMainRelease(sha, {
  repo = process.env.GITHUB_REPOSITORY,
  token = process.env.GITHUB_TOKEN,
  request = fetch,
  apiRoot = process.env.GITHUB_API_URL || "https://api.github.com"
} = {}) {
  if (!SHA.test(sha)) throw Error("Expected a 40-character lowercase commit SHA");
  if (!REPO.test(repo || "")) throw Error("GITHUB_REPOSITORY missing/invalid");
  if (!token) throw Error("GITHUB_TOKEN missing");
  const root = new URL(apiRoot);
  if (root.protocol !== "https:" || root.username || root.password) {
    throw Error("GitHub API endpoint must use HTTPS without credentials in URL");
  }
  const url = new URL("repos/" + repo + "/actions/workflows/bunny-managed-image.yml/runs", root.href.endsWith("/") ? root : root.href + "/");
  url.searchParams.set("head_sha", sha);
  url.searchParams.set("branch", "main");
  url.searchParams.set("status", "success");
  url.searchParams.set("per_page", "100");
  const response = await request(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "kumaedge-release-preflight"
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Error("GitHub Actions release lookup failed: HTTP " + response.status);
  const payload = await response.json();
  // A green build can have skipped publication when both SHA tags already exist.
  // Require the digest artifact created ONLY after this run really pushed both.
  const eligible = Array.isArray(payload.workflow_runs) ? payload.workflow_runs.filter(run =>
    hasSuccessfulMainRelease({ workflow_runs: [run] }, sha) &&
    Number.isSafeInteger(run.id) && run.id > 0
  ) : [];
  for (const run of eligible) {
    const artifactUrl = new URL("repos/" + repo + "/actions/runs/" + run.id + "/artifacts?per_page=100",
      root.href.endsWith("/") ? root : root.href + "/");
    const artifactsResponse = await request(artifactUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + token,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "kumaedge-release-preflight"
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!artifactsResponse.ok) throw Error("Publisher artifacts lookup failed: HTTP " + artifactsResponse.status);
    const artifacts = await artifactsResponse.json();
    const found = Array.isArray(artifacts.artifacts) && artifacts.artifacts.some(artifact =>
      artifact.name === "kumaedge-oci-digests-" + sha &&
      artifact.expired === false &&
      Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0
    );
    if (found) return { sha, verified: true, runId: run.id };
  }
  throw Error("No successful main push publisher with unexpired OCI digest evidence for this SHA");
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  checkMainRelease(process.argv[2]).then(result => {
    // Written into $GITHUB_OUTPUT by the protected deploy workflow.
    process.stdout.write("run_id=" + result.runId + "\n");
  }).catch(error => {
    process.stderr.write("Release provenance FAILED: " + error.message + "\n");
    process.exitCode = 1;
  });
}
