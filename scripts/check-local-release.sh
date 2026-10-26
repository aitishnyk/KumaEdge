#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "${1:-}" == "$(git rev-parse HEAD)" ]] || { echo 'Usage: check-local-release.sh EXACT_CURRENT_SHA'; exit 2; }
source scripts/local/common.sh
require_source
python3 scripts/local/evidence.py verify
IMAGE_TAG="$SHA" GITHUB_REPOSITORY=aitishnyk/kumaedge node scripts/oci-release-evidence.mjs verify "$EVIDENCE/evidence.json"
