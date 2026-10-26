#!/usr/bin/env bash
set -euo pipefail
image="${1:?image required}"
scratch="$(mktemp -d)"
name="kumaedge-tls-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf -- "$scratch"; }
trap cleanup EXIT
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$scratch/key.pem" -out "$scratch/cert.pem" -days 1 -subj /CN=localhost -addext subjectAltName=DNS:localhost >/dev/null 2>&1
# docker cp avoids depending on Docker Desktop host file sharing.
for trust in untrusted trusted; do
  if [[ "$trust" == trusted ]]; then args=(-e NODE_EXTRA_CA_CERTS=/fixtures/cert.pem); else args=(-e EXPECT_UNTRUSTED=yes); fi
  docker create --name "$name" "${args[@]}" --entrypoint node "$image" /app/tls-regression.cjs >/dev/null
  docker cp "$scratch" "$name:/fixtures" >/dev/null
  docker cp scripts/local/tls-regression.cjs "$name:/app/tls-regression.cjs" >/dev/null
  docker start -a "$name"
  [[ "$(docker inspect -f '{{.State.ExitCode}}' "$name")" == 0 ]]
  docker rm "$name" >/dev/null
done
