#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
[[ "$(uname -s)" == Darwin ]] || { echo 'Local Mac required'; exit 2; }
for binary in git gh docker node npm python3 terraform curl age age-keygen; do
  command -v "$binary" >/dev/null || { echo "Missing $binary"; exit 2; }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 22 || typeof WebSocket !== "function") process.exit(1)' || { echo "Node 22+ with WebSocket required"; exit 2; }
docker info >/dev/null
docker buildx inspect --bootstrap
[[ "$(docker info --format '{{.OSType}}')" == linux ]]
printf 'Host CPU: %s; target: linux/amd64; source: %s\n' "$(uname -m)" "$SHA"
docker version --format '{{json .}}' > "$EVIDENCE/docker.json"
docker buildx version > "$EVIDENCE/buildx.txt"
