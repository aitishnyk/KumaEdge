#!/usr/bin/env bash
# Disposable real-Uptime-Kuma disaster-recovery acceptance; NEVER touches Bunny.
set -euo pipefail
image="${1:-kumaedge:smoke}"
id="kumaedge-dr-$$"
first_volume="$id-original"
second_volume="$id-recovered"
first_container="$id-first"
second_container="$id-second"
scratch="$(mktemp -d)"
cleanup() {
  docker rm -f "$first_container" "$second_container" >/dev/null 2>&1 || true
  docker volume rm "$first_volume" "$second_volume" >/dev/null 2>&1 || true
  rm -rf -- "$scratch"
}
trap cleanup EXIT

for dependency in docker python3 age age-keygen curl node; do
  command -v "$dependency" >/dev/null || { echo "Missing $dependency" >&2; exit 2; }
done
mkdir -p "$scratch/source"
docker volume create "$first_volume" >/dev/null
docker volume create "$second_volume" >/dev/null

start() {
  local name="$1" volume="$2" port healthy=0
  docker run -d --name "$name" -p 127.0.0.1::3001 -v "$volume:/app/data" "$image" >/dev/null
  port="$(docker port "$name" 3001/tcp | awk -F: 'NR==1{print $NF}')"
  [[ "$port" =~ ^[0-9]+$ ]] || { echo "Port mapping missing" >&2; return 1; }
  for _ in $(seq 1 100); do
    if curl -sSf --max-time 2 -o /dev/null "http://127.0.0.1:$port/"; then healthy=1; break; fi
    if [[ "$(docker inspect -f '{{.State.Running}}' "$name")" != "true" ]]; then break; fi
    sleep 2
  done
  if [[ "$healthy" != 1 ]]; then
    docker logs --tail 80 "$name" || true
    echo "Real Uptime Kuma boot failed" >&2
    return 1
  fi
  node scripts/check-production.mjs --url "http://127.0.0.1:$port" --mode smoke --allow-local-http
}

echo "Booting real source Uptime Kuma image with temporary named volume"
start "$first_container" "$first_volume"
docker exec "$first_container" sh -c '
  test -s /app/data/kuma.db &&
  mkdir -p /app/data/kumaedge-dr-synthetic &&
  printf "recovery-sentinel\n" > /app/data/kumaedge-dr-synthetic/check.txt
'
docker rm -f "$first_container" >/dev/null

original_owner="$(docker run --rm --user 0 --entrypoint sh \
  -v "$first_volume:/volume:ro" "$image" \
  -c 'stat -c "%u:%g" /volume/kuma.db')"
[[ "$original_owner" =~ ^[0-9]+:[0-9]+$ ]] || { echo "Invalid database owner" >&2; exit 1; }

# The sole SQLite writer has stopped; read a private export of its entire volume.
docker run --rm --user 0 --entrypoint sh \
  -v "$first_volume:/volume:ro" -v "$scratch/source:/export" "$image" \
  -c "cp -a /volume/. /export/ && chown -R $(id -u):$(id -g) /export"
test -s "$scratch/source/kuma.db"

python3 - "$scratch/source/kuma.db" <<'PY'
import sqlite3, sys
from pathlib import Path
p=Path(sys.argv[1])
with sqlite3.connect(p.as_uri() + "?mode=ro", uri=True) as db:
    if db.execute("PRAGMA integrity_check").fetchone() != ("ok",):
        raise SystemExit("Source SQLite failed full integrity check")
print("PASS real container SQLite integrity")
PY

age-keygen -o "$scratch/identity.txt" >/dev/null 2>&1
recipient="$(age-keygen -y "$scratch/identity.txt")"
export KUMAEDGE_APP_STOPPED=yes
python3 scripts/volume-backup.py backup "$scratch/source" "$scratch/encrypted.age" "$recipient"
python3 scripts/volume-backup.py verify "$scratch/encrypted.age" "$scratch/identity.txt"
python3 scripts/volume-backup.py restore "$scratch/encrypted.age" "$scratch/identity.txt" "$scratch/restored"
unset KUMAEDGE_APP_STOPPED
diff -qr "$scratch/source" "$scratch/restored"
cmp "$scratch/source/kumaedge-dr-synthetic/check.txt" "$scratch/restored/kumaedge-dr-synthetic/check.txt"

# Copy the independent verified restore into a NEW volume. UID/GID must be
# adapted to the real image's database writer after offline restore.
docker run --rm --user 0 --entrypoint sh \
  -v "$second_volume:/volume" -v "$scratch/restored:/source:ro" "$image" \
  -c "cp -a /source/. /volume/ && chown -R '$original_owner' /volume"

echo "Booting fresh Uptime Kuma container from separately restored volume"
start "$second_container" "$second_volume"
docker exec "$second_container" sh -c '
  test -s /app/data/kuma.db &&
  grep -Fxq recovery-sentinel /app/data/kumaedge-dr-synthetic/check.txt
'
echo "PASS: real image started with independently encrypted, restored full-volume data"
