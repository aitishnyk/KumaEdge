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
  if (!hasSuccessfulMainRelease(payload, sha)) {
    throw Error("No completed, successful main-branch push release for this SHA");
  }
  return { sha, verified: true };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  checkMainRelease(process.argv[2]).then(() => {
    process.stdout.write("PASS: official main push release completed for requested SHA\n");
  }).catch(error => {
    process.stderr.write("Release provenance FAILED: " + error.message + "\n");
    process.exitCode = 1;
  });
}
