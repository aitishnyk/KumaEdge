#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
[[ "${1:-}" == https://* ]] || { echo 'Usage: acceptance.sh https://public-host'; exit 2; }
node scripts/check-production.mjs --url "$1" --mode production
# Network acceptance alone is not persistence, notification or DR certification.
