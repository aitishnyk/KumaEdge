#!/usr/bin/env bash
set -euo pipefail
image="${1:-kumaedge:smoke}"
name="kumaedge-smoke-$$"
volume="kumaedge-smoke-$$"
docker volume create "$volume" >/dev/null
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
start() {
  docker run -d --name "$name" -p 127.0.0.1::3001 -v "$volume:/app/data" "$image" >/dev/null
  port="$(docker port "$name" 3001/tcp | awk -F: 'NR==1{print $NF}')"
  [[ "$port" =~ ^[0-9]+$ ]] || { echo 'Container port mapping missing'; exit 1; }
  ready=0
  for _ in $(seq 1 100); do
    if curl --silent --fail --max-time 2 -o /dev/null "http://127.0.0.1:$port/"; then ready=1; break; fi
    if ! docker inspect -f '{{.State.Running}}' "$name" | grep -q true; then break; fi
    sleep 2
  done
  if [[ "$ready" != 1 ]]; then docker logs "$name"; echo 'HTTP smoke failed'; exit 1; fi
}
start
docker exec "$name" sh -c 'test -d /app/data && touch /app/data/kumaedge-persistence-check'
docker rm -f "$name" >/dev/null
start
docker exec "$name" sh -c 'test -f /app/data/kumaedge-persistence-check'
docker exec "$name" sh -c 'test -f /app/server/server.js || test -f /app/server.js'
echo 'PASS: full upstream web server and persistent volume survived restart'
