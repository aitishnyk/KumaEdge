#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
require_source
python3 scripts/local/evidence.py verify
[[ "${1:-}" == --keychain || -t 0 ]] || { echo 'Registry login requires your trusted interactive terminal.'; exit 2; }
release_config="$(mktemp -d)"
trap 'rm -rf -- "$release_config"; unset registry_token' EXIT
# Preserve access to the installed Buildx plugin without copying credentials.
mkdir -p "$release_config/cli-plugins"
plugin="$(command -v docker-buildx || true)"
if [[ -z "$plugin" ]]; then
  for candidate in /Applications/Docker.app/Contents/Resources/cli-plugins/docker-buildx "$HOME/.docker/cli-plugins/docker-buildx"; do
    if [[ -x "$candidate" ]]; then plugin="$candidate"; break; fi
  done
fi
[[ -n "$plugin" ]] || { echo 'Cannot locate Buildx plugin'; exit 2; }
ln -s "$plugin" "$release_config/cli-plugins/docker-buildx"
if [[ "${1:-}" == --keychain ]]; then
  python3 scripts/local/registry-login.py "$release_config"
else
  read -r -p 'GHCR username: ' registry_user
  read -r -s -p 'GHCR write:packages token (hidden): ' registry_token
  printf '\n'
  printf '%s' "$registry_token" | docker --config "$release_config" login ghcr.io -u "$registry_user" --password-stdin >/dev/null
  unset registry_token
fi
release_docker_host="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
unset DOCKER_CONTEXT
export DOCKER_HOST="$release_docker_host"
export DOCKER_CONFIG="$release_config"
rm -f "$EVIDENCE/publish-guard.txt"
# The guard distinguishes missing manifests from permission/network failures.
GITHUB_REPOSITORY=aitishnyk/kumaedge GITHUB_SHA="$SHA" GITHUB_OUTPUT="$EVIDENCE/publish-guard.txt" node scripts/guard-ghcr-publish.mjs
if grep -qx 'publish=false' "$EVIDENCE/publish-guard.txt"; then
  echo 'SHA tags already exist; refusing overwrite. Verify existing evidence separately.'; exit 2
fi
require_source
python3 scripts/local/evidence.py verify
for kind in main backup; do
  if [[ "$kind" == main ]]; then image="$main_image"; remote="ghcr.io/aitishnyk/kumaedge:$SHA"; else image="$backup_image"; remote="ghcr.io/aitishnyk/kumaedge-backup:$SHA"; fi
  docker tag "$image" "$remote"
  docker push "$remote" > "$EVIDENCE/push-$kind.log" 2>&1
  # Pull the registry object and compare its config ID with the tested image.
  docker pull --platform linux/amd64 "$remote" > "$EVIDENCE/pull-$kind.log" 2>&1
  [[ "$(docker image inspect -f '{{.Id}}' "$remote")" == "$(docker image inspect -f '{{.Id}}' "$image")" ]]
done
IMAGE_TAG="$SHA" GITHUB_REPOSITORY=aitishnyk/kumaedge node scripts/oci-release-evidence.mjs record "$EVIDENCE/evidence.json"
IMAGE_TAG="$SHA" GITHUB_REPOSITORY=aitishnyk/kumaedge node scripts/oci-release-evidence.mjs verify "$EVIDENCE/evidence.json"
