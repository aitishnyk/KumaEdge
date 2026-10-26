#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
SHA="$(git rev-parse HEAD)"
EVIDENCE="$ROOT/.local-release/$SHA"
mkdir -p "$EVIDENCE"
export PYTHONDONTWRITEBYTECODE=1
require_source() {
  [[ "${KUMAEDGE_REVIEWED_SHA:-}" == "$SHA" ]] || { echo 'Set KUMAEDGE_REVIEWED_SHA to the exact reviewed HEAD.' >&2; exit 2; }
  [[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo 'Release source tree must be clean.' >&2; exit 2; }
  [[ -z "${CI:-}" ]] || { echo 'Run on trusted local Mac, outside CI.' >&2; exit 2; }
}
main_image="kumaedge-local:$SHA"
backup_image="kumaedge-backup-local:$SHA"
