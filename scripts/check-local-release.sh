#!/usr/bin/env bash
# Read-only official main publisher and BOTH GHCR manifests verification on a private Mac.
# No Bunny account API key, no paid operations, no remote mutations.
set -euo pipefail
umask 077
repo="aitishnyk/KumaEdge"
sha="${1:-}"
if [[ ! "$sha" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Usage: bash scripts/check-local-release.sh PUBLISHED_FULL_40_CHAR_MAIN_SHA" >&2
  exit 2
fi
if [[ -n "${CI:-}" || ! -t 0 ]]; then
  echo "Run locally in a trusted interactive terminal, not untrusted CI." >&2
  exit 2
fi
for tool in gh docker node; do
  command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 2; }
done
docker buildx version >/dev/null || { echo "Docker Buildx is required" >&2; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "Use gh auth login locally first" >&2; exit 2; }
user="$(gh api user --jq .login)"
[[ -n "$user" ]] || { echo "Cannot identify GitHub CLI registry username" >&2; exit 2; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
private="$(mktemp -d)"
chmod 0700 "$private"
cleanup() {
  rm -rf -- "$private"
  unset GITHUB_TOKEN GH_TOKEN DOCKER_CONFIG
}
trap cleanup EXIT
mkdir -p "$private/docker" "$private/evidence"
chmod 0700 "$private/docker"
export GITHUB_TOKEN="$(gh auth token)"
[[ -n "$GITHUB_TOKEN" ]] || { echo "Missing GitHub CLI token" >&2; exit 2; }
export GH_TOKEN="$GITHUB_TOKEN"
export GITHUB_REPOSITORY="$repo"
echo "Checking official successful main SHA publisher..."
response="$(node "$root/scripts/verify-release-provenance.mjs" "$sha")" || exit 1
if [[ -z "$response" ]]; then
  echo "Publisher proof CLI returned no run_id (entrypoint produced no output); refuse release." >&2
  exit 1
fi
[[ "$response" =~ ^run_id=([0-9]+)$ ]] || {
  echo "Publisher proof CLI returned an invalid run_id format; refuse release." >&2
  exit 1
}
run_id="${BASH_REMATCH[1]}"
echo "Fetching official image digest evidence from run $run_id..."
gh run download "$run_id" --repo "$repo" --name "kumaedge-oci-digests-$sha" --dir "$private/evidence" >/dev/null
test -s "$private/evidence/evidence.json" || { echo "Missing publisher evidence" >&2; exit 1; }
printf '%s' "$GITHUB_TOKEN" | docker --config "$private/docker" login ghcr.io --username "$user" --password-stdin >/dev/null
export DOCKER_CONFIG="$private/docker"
export IMAGE_TAG="$sha"
echo "Comparing the actual main AND backup GHCR OCI manifests with publisher evidence..."
node "$root/scripts/oci-release-evidence.mjs" verify "$private/evidence/evidence.json"
echo "PASS: official main publisher proof + current GHCR main/backup digests. Bunny unchanged."
echo "This is read-only release verification; it does NOT prove Bunny is production ready."
