#!/usr/bin/env bash
# Review-only upstream Docker digest watcher: NEVER merges or deploys.
set -euo pipefail
[[ -n "$GH_TOKEN" && -n "$REPO" ]] || { echo "GitHub identity missing" >&2; exit 2; }
command -v docker >/dev/null || { echo "Docker missing" >&2; exit 2; }
command -v gh >/dev/null || { echo "gh missing" >&2; exit 2; }

CURRENT="$(sed -nE 's|^FROM louislam/uptime-kuma:2@(sha256:[a-f0-9]{64})$|\1|p' Dockerfile)"
if [[ ! "$CURRENT" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "::error::Dockerfile lacks a valid reviewed Uptime Kuma digest"
  exit 2
fi
LATEST="$(docker buildx imagetools inspect docker.io/louislam/uptime-kuma:2 |
  sed -nE 's/^Digest:[[:space:]]*(sha256:[a-f0-9]{64})[[:space:]]*$/\1/p' | head -n1)"
if [[ ! "$LATEST" =~ ^sha256:[a-f0-9]{64}$ ]]; then
  echo "::error::Could not securely read the upstream registry digest"
  exit 2
fi
if [[ "$LATEST" == "$CURRENT" ]]; then
  echo "Uptime Kuma digest matches reviewed pin."
  exit 0
fi

SHORT="$(printf '%s' "$LATEST" | cut -c8-19)"
BRANCH="automation/uptime-image-$SHORT"
TITLE="Review Uptime Kuma image digest $SHORT"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
if gh api "repos/$REPO/git/ref/heads/$BRANCH" >/dev/null 2>&1; then
  echo "Review branch already exists: $BRANCH"
else
  git switch -c "$BRANCH"
  CURRENT="$CURRENT" LATEST="$LATEST" python3 - <<'PY'
import os
from pathlib import Path
path=Path("Dockerfile")
old="FROM louislam/uptime-kuma:2@" + os.environ["CURRENT"]
new="FROM louislam/uptime-kuma:2@" + os.environ["LATEST"]
source=path.read_text()
if source.count(old) != 1:
    raise SystemExit("Expected exactly one pinned upstream base image")
path.write_text(source.replace(old,new))
PY
  git add Dockerfile
  git commit -m "chore: review Uptime Kuma image digest $SHORT"
  git push origin "$BRANCH"
fi

if gh pr list --repo "$REPO" --state open --head "$BRANCH" --json number --jq 'length' |
    grep -Eq '^[1-9][0-9]*$'; then
  echo "Matching review PR already open."
  exit 0
fi

BODY="$(mktemp)"
trap 'rm -f "$BODY"' EXIT
{
  echo "## Upstream Uptime Kuma image change"
  echo ""
  echo "Old pinned Docker digest: $CURRENT"
  echo "New current Docker Hub digest: $LATEST"
  echo ""
  echo "Review security advisories, upstream changes, Docker smoke/DR and compatibility."
  echo "This PR only changes the pinned Dockerfile image digest."
  echo "Never auto-merge. Production deployment requires separate explicit approval."
} > "$BODY"

if gh pr create --repo "$REPO" --base main --head "$BRANCH" \
    --title "$TITLE" --body-file "$BODY"; then
  echo "New upstream review PR opened."
  exit 0
fi

# GitHub Actions often has repo-level PR creation disabled. Keep a visible Issue.
echo "::warning::PR creation denied; creating deduplicated fallback Issue."
if gh issue list --repo "$REPO" --state open --search "$TITLE in:title" \
    --json title --jq '.[].title' | grep -Fxq "$TITLE"; then
  echo "Fallback Issue already exists."
  exit 0
fi
gh issue create --repo "$REPO" --title "$TITLE" --body-file "$BODY"
