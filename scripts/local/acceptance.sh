#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
require_source
[[ "${1:-}" == https://* ]] || { echo 'Usage: acceptance.sh https://public-host'; exit 2; }
export KUMAEDGE_PUBLIC_URL="$1"
# The owner supplies the gateway secret privately; never as a command argument.
if [[ -z "${KUMAEDGE_FRONT_DOOR_PASSWORD:-}" ]]; then
  [[ -s "$EVIDENCE/owner-gateway-password.private" ]] || { echo 'Private owner gateway password unavailable'; exit 2; }
  KUMAEDGE_FRONT_DOOR_PASSWORD="$(cat "$EVIDENCE/owner-gateway-password.private")"
  export KUMAEDGE_FRONT_DOOR_PASSWORD
fi
name="kumaedge-public-acceptance-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true; unset KUMAEDGE_FRONT_DOOR_PASSWORD' EXIT
docker create --name "$name" -e KUMAEDGE_PUBLIC_URL -e KUMAEDGE_FRONT_DOOR_PASSWORD --entrypoint node "$main_image" /app/public-acceptance.cjs >/dev/null
docker cp scripts/local/public-acceptance.cjs "$name:/app/public-acceptance.cjs" >/dev/null
docker start -a "$name"
[[ "$(docker inspect -f '{{.State.ExitCode}}' "$name")" == 0 ]]
