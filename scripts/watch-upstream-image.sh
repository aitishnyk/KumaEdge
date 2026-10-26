#!/usr/bin/env bash
set -euo pipefail
exec bash "$(dirname "$0")/local/update-upstream.sh" "$@"
