#!/usr/bin/env bash
# Exercise the operator workflow against disposable LOCAL real Kuma, not Bunny.
set -euo pipefail
umask 077
image="${1:?image required}"; id="kumaedge-bootstrap-$$"; volume="$id-data"; temp="$(mktemp -d)"
cleanup(){ docker rm -f "$id" >/dev/null 2>&1 || true; docker volume rm "$volume" >/dev/null 2>&1 || true; rm -rf "$temp"; }
trap cleanup EXIT
age-keygen -o "$temp/key" >/dev/null 2>&1
export KUMAEDGE_BACKUP_RECIPIENT="$(age-keygen -y "$temp/key")"
export KUMAEDGE_OPS_TOKEN="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
export KUMAEDGE_DISPOSABLE_RESET_NONCE="$(python3 -c 'import secrets;print(secrets.token_hex(32))')"
export KUMAEDGE_RESET_TARGET_APP_ID=E2quWe26NmOfL7q
export KUMAEDGE_FRONT_DOOR_PASSWORD="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
export KUMAEDGE_OWNER_PASSWORD="$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')"
export KUMAEDGE_PUBLIC_URL=http://127.0.0.1:3002
export KUMAEDGE_PERMIT_FRESH_SETUP=true
docker volume create "$volume" >/dev/null
docker run -d --name "$id" -v "$volume:/app/data" -e KUMAEDGE_BACKUP_RECIPIENT -e KUMAEDGE_OPS_TOKEN -e KUMAEDGE_DISPOSABLE_RESET_NONCE -e KUMAEDGE_RESET_TARGET_APP_ID -e KUMAEDGE_FRONT_DOOR_PASSWORD -e KUMAEDGE_OWNER_PASSWORD -e KUMAEDGE_PUBLIC_URL -e KUMAEDGE_PERMIT_FRESH_SETUP "$image" node /opt/kumaedge/engine-launch.cjs >/dev/null
for _ in $(seq 1 90); do
 if docker exec "$id" node -e 'fetch("http://127.0.0.1:3001/").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec -d "$id" node /opt/kumaedge/front-door.cjs
sleep 1
docker cp scripts/local/bootstrap-live.cjs "$id:/app/bootstrap-live.cjs" >/dev/null
docker exec "$id" node /app/bootstrap-live.cjs
docker exec "$id" node -e 'const fs=require("fs"),{spawnSync}=require("child_process");const secret=JSON.parse(fs.readFileSync("/tmp/kumaedge-bootstrap-secrets.private.json")).totpSecret;const r=spawnSync(process.execPath,["/app/bootstrap-live.cjs"],{env:{...process.env,KUMAEDGE_OWNER_TOTP_SECRET:secret,KUMAEDGE_BOOTSTRAP_MODE:"check"},stdio:"inherit"});process.exit(r.status||0);'
echo 'PASS real disposable local owner bootstrap/TOTP/logout/relogin, HTTPS/TCP/controlled monitors, DOWN/UP, public status-page provisioning'
