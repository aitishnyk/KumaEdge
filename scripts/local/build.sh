#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
require_source
[[ "$(cat "$EVIDENCE/tests.pass")" == "$SHA" ]]
rm -f "$EVIDENCE/verified.json"
for kind in main backup; do
  if [[ "$kind" == main ]]; then file=Dockerfile; image="$main_image"; else file=Dockerfile.backup; image="$backup_image"; fi
  docker buildx build --platform linux/amd64 --provenance=false --load --label "org.opencontainers.image.revision=$SHA" -f "$file" -t "$image" . > "$EVIDENCE/build-$kind.log" 2>&1
  docker image inspect "$image" > "$EVIDENCE/image-$kind.json"
done
require_source
