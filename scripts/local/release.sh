#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
for stage in doctor test build verify; do bash "scripts/local/$stage.sh"; done
if [[ "${1:-}" == --publish ]]; then bash scripts/local/publish.sh; fi
echo 'Local release complete; live deployment and live certification remain separate gates.'
