#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
require_source
rm -f "$EVIDENCE/verified.json"
for image in "$main_image" "$backup_image"; do
  [[ "$(docker image inspect -f '{{.Os}}/{{.Architecture}}' "$image")" == linux/amd64 ]]
done
bash scripts/local/tls-regression.sh "$main_image" > "$EVIDENCE/tls.log" 2>&1
bash scripts/local/bootstrap-local.sh "$main_image" > "$EVIDENCE/bootstrap.log" 2>&1
bash scripts/local/operations.sh "$main_image" > "$EVIDENCE/operations.log" 2>&1
bash scripts/local/runtime.sh "$main_image" > "$EVIDENCE/monitoring.log" 2>&1
bash scripts/smoke-managed.sh "$main_image" > "$EVIDENCE/runtime.log" 2>&1
bash scripts/smoke-disaster-recovery.sh "$main_image" > "$EVIDENCE/recovery.log" 2>&1
docker run --rm --entrypoint age "$main_image" --version > "$EVIDENCE/main-age.log"
docker run --rm --entrypoint age "$backup_image" --version > "$EVIDENCE/backup-age.log"
bash scripts/local/runtime.sh 'louislam/uptime-kuma:2@sha256:9912da7d7d9b6ddc0c2d904beb84d24689c1ed9c33b81419eb9008663a92a329' "$main_image" > "$EVIDENCE/migration.log" 2>&1
python3 scripts/local/secret-scan.py
require_source
python3 scripts/local/evidence.py record
