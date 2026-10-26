#!/usr/bin/env bash
set -euo pipefail
image="${1:?image required}"
upgrade_image="${2:-$image}"
id="kumaedge-real-$$"
volume="$id-data"
docker volume create "$volume" >/dev/null
cleanup() { docker rm -f "$id" >/dev/null 2>&1 || true; docker volume rm "$volume" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d -e UPTIME_KUMA_DB_TYPE=sqlite --name "$id" -p 127.0.0.1::3001 -v "$volume:/app/data" "$image" >/dev/null
for n in $(seq 1 100); do
  if docker exec "$id" node -e 'fetch("http://127.0.0.1:3001/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then break; fi
  sleep 2
done
docker cp scripts/local/runtime.cjs "$id:/app/kumaedge-acceptance.cjs" >/dev/null
docker exec "$id" node /app/kumaedge-acceptance.cjs seed
docker stop --time 30 "$id" >/dev/null
docker rm "$id" >/dev/null
docker run -d -e UPTIME_KUMA_DB_TYPE=sqlite --name "$id" -p 127.0.0.1::3001 -v "$volume:/app/data" "$upgrade_image" >/dev/null
docker cp scripts/local/runtime.cjs "$id:/app/kumaedge-acceptance.cjs" >/dev/null
for n in $(seq 1 100); do
  if docker exec "$id" node -e 'fetch("http://127.0.0.1:3001/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then break; fi
  sleep 2
done
docker exec "$id" node /app/kumaedge-acceptance.cjs check
