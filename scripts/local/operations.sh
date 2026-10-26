#!/usr/bin/env bash
# Real supervisor/reset/backup checks on disposable LOCAL volumes only.
set -euo pipefail
umask 077
image="${1:?image required}"
id="kumaedge-ops-$$"; scratch="$(mktemp -d)"; first="$id-source"; second="$id-restore"
cleanup() { docker rm -f "$id" "$id-restored" "$id-import" >/dev/null 2>&1 || true; docker volume rm "$first" "$second" >/dev/null 2>&1 || true; rm -rf "$scratch"; }
trap cleanup EXIT
age-keygen -o "$scratch/identity" >/dev/null 2>&1
export KUMAEDGE_BACKUP_RECIPIENT="$(age-keygen -y "$scratch/identity")"
export KUMAEDGE_OPS_TOKEN="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
export KUMAEDGE_DISPOSABLE_RESET_NONCE="$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
export KUMAEDGE_RESET_TARGET_APP_ID=E2quWe26NmOfL7q
export KUMAEDGE_FRONT_DOOR_PASSWORD="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
docker volume create "$first" >/dev/null; docker volume create "$second" >/dev/null
docker run --rm --network none -v "$first:/app/data" "$image" sh -c 'printf preserve > /app/data/no-reset-sentinel'
if docker run --rm --network none -v "$first:/app/data" -e KUMAEDGE_BACKUP_RECIPIENT -e KUMAEDGE_OPS_TOKEN -e KUMAEDGE_DISPOSABLE_RESET_NONCE -e KUMAEDGE_RESET_TARGET_APP_ID=another-app "$image" node /opt/kumaedge/engine-launch.cjs; then echo 'Wrong-app reset unexpectedly accepted'; exit 1; fi
docker run --rm --network none -v "$first:/app/data" "$image" sh -c 'test "$(cat /app/data/no-reset-sentinel)" = preserve' 
start() {
 local name="$1" volume="$2"
 docker run -d --network none --name "$name" -v "$volume:/app/data" -e KUMAEDGE_BACKUP_RECIPIENT -e KUMAEDGE_OPS_TOKEN -e KUMAEDGE_DISPOSABLE_RESET_NONCE -e KUMAEDGE_RESET_TARGET_APP_ID -e KUMAEDGE_FRONT_DOOR_PASSWORD "$image" node /opt/kumaedge/engine-launch.cjs >/dev/null
 for _ in $(seq 1 90); do
  if docker exec "$name" node -e 'fetch("http://127.0.0.1:3001/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then return; fi
  sleep 1
 done
 echo 'Supervised Kuma readiness failed'; return 1
}
start "$id" "$first"
docker cp scripts/local/runtime.cjs "$id:/app/operations-runtime.cjs" >/dev/null
docker exec "$id" node /app/operations-runtime.cjs seed
docker exec "$id" sh -c 'test ! -e /app/data/no-reset-sentinel'
docker exec -d "$id" node /opt/kumaedge/front-door.cjs
sleep 1
# A forged operations credential cannot trigger backup or mutate the target.
docker exec "$id" node -e 'fetch("http://127.0.0.1:3002/__kumaedge/backup",{method:"POST",headers:{authorization:"Basic "+Buffer.from("owner:"+process.env.KUMAEDGE_FRONT_DOOR_PASSWORD).toString("base64"),"x-kumaedge-ops-token":"wrong"}}).then(r=>{if(r.status!==403)process.exit(1)})'
docker exec "$id" node -e 'const fs=require("fs"),crypto=require("crypto");(async()=>{const r=await fetch("http://127.0.0.1:3002/__kumaedge/backup",{method:"POST",headers:{authorization:"Basic "+Buffer.from("owner:"+process.env.KUMAEDGE_FRONT_DOOR_PASSWORD).toString("base64"),"x-kumaedge-ops-token":process.env.KUMAEDGE_OPS_TOKEN}});if(!r.ok)throw Error("backup failed");const b=Buffer.from(await r.arrayBuffer());if(crypto.createHash("sha256").update(b).digest("hex")!==r.headers.get("x-kumaedge-backup-sha256"))throw Error("checksum mismatch");fs.writeFileSync("/tmp/ops-volume.age",b,{mode:0o600});})().catch(()=>process.exit(1))'
docker cp "$id:/tmp/ops-volume.age" "$scratch/volume.age" >/dev/null
python3 scripts/volume-backup.py verify "$scratch/volume.age" "$scratch/identity"
KUMAEDGE_APP_STOPPED=yes python3 scripts/volume-backup.py restore "$scratch/volume.age" "$scratch/identity" "$scratch/restored"
test -s "$scratch/restored/kuma.db"; test -s "$scratch/restored/acceptance-assets/sentinel.txt"
# Restart the SAME source volume: the one-shot reset marker must preserve users/history.
docker stop --time 45 "$id" >/dev/null; docker rm "$id" >/dev/null
start "$id" "$first"; docker cp scripts/local/runtime.cjs "$id:/app/operations-runtime.cjs" >/dev/null
docker exec "$id" node /app/operations-runtime.cjs check
docker create --name "$id-import" --user 0 --entrypoint sh -v "$second:/volume" "$image" -c 'chown -R 0:0 /volume' >/dev/null
docker cp "$scratch/restored/." "$id-import:/volume" >/dev/null; docker start -a "$id-import" >/dev/null
start "$id-restored" "$second"; docker cp scripts/local/runtime.cjs "$id-restored:/app/operations-runtime.cjs" >/dev/null
docker exec "$id-restored" node /app/operations-runtime.cjs check
echo 'PASS real engine supervisor: one-shot reset, same-volume restart, clean-writer encrypted full backup and isolated restore'
