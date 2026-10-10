#!/usr/bin/env bash
# One-shot local macOS acceptance. Not a registered GitHub Actions runner.
# No Bunny API, paid provisioning, or untrusted pull-request execution.
set -uo pipefail
export LC_ALL=C
umask 077
REPO="aitishnyk/KumaEdge"
PR=34

if [ "$#" -ne 1 ] || ! [[ "$1" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Usage: bash run-mac-acceptance.sh EXACT_40_CHAR_REVIEWED_PR_SHA" >&2; exit 2
fi
SHA="$1"
if [ "$(uname -s)" != "Darwin" ]; then
  echo "This local acceptance harness is intended for macOS." >&2; exit 2
fi
for binary in gh git; do
  command -v "$binary" >/dev/null 2>&1 || { echo "Install $binary first." >&2; exit 2; }
done
gh auth status >/dev/null 2>&1 || { echo "Run gh auth login first." >&2; exit 2; }
head="$(gh api "repos/$REPO/pulls/$PR" --jq '.head.sha' 2>/dev/null)" || {
  echo "Cannot verify PR head; refusing to execute unaudited source." >&2; exit 2;
}
[ "$head" = "$SHA" ] || {
  echo "PR head changed; supplied pinned SHA is not current. Refusing." >&2; exit 2;
}

ROOT="$(mktemp -d)" || exit 2
LOGS="$ROOT/logs"
mkdir -p "$LOGS"
REPORT="$ROOT/summary.md"
RESULTS="$ROOT/results.txt"
touch "$RESULTS"
echo "Local logs directory: $LOGS"
echo "Cloning precisely $SHA ..."
git clone --quiet --no-checkout --filter=blob:none "https://github.com/$REPO.git" "$ROOT/repo" || exit 2
cd "$ROOT/repo" || exit 2
git -c advice.detachedHead=false checkout --quiet --detach "$SHA" || exit 2
[ "$(git rev-parse HEAD)" = "$SHA" ] || { echo "SHA mismatch!" >&2; exit 2; }

failures=0
skips=0
passes=0
record() {
  printf '%s|%s\n' "$1" "$2" >> "$RESULTS"
  echo "$1: $2"
  case "$2" in
    PASS) passes=$((passes+1));;
    FAIL) failures=$((failures+1));;
    SKIP) skips=$((skips+1));;
  esac
}
check() {
  title="$1"; file="$2"; shift 2
  echo "Running $title ..."
  if "$@" > "$LOGS/$file.log" 2>&1; then record "$title" PASS; return 0
  else record "$title" FAIL; echo "Private log: $LOGS/$file.log"; return 1
  fi
}
if command -v node >/dev/null && command -v npm >/dev/null; then
  check "Node full regression" node npm test || true
else record "Node full regression (node/npm unavailable)" SKIP; fi

if command -v python3 >/dev/null; then
  check "Python unit regression" python python3 -m unittest discover -s test/python -v || true
  check "Python syntax" py-syntax python3 -m compileall -q scripts || true
else
  record "Python unit regression (python3 unavailable)" SKIP
  record "Python syntax (python3 unavailable)" SKIP
fi
check "Bash static syntax" bash-syntax bash -n scripts/install-bunny.sh scripts/run-mac-acceptance.sh scripts/smoke-managed.sh scripts/smoke-disaster-recovery.sh || true

if command -v age >/dev/null && command -v age-keygen >/dev/null && command -v python3 >/dev/null; then
  check "Real age encrypted full-volume backup and restore" age-recovery bash -c '
    set -euo pipefail
    tmp="$(mktemp -d)"
    trap "rm -rf -- $tmp" EXIT
    mkdir -p "$tmp/volume/assets"
    printf "sqlite-test" > "$tmp/volume/kuma.db"
    printf "image-test" > "$tmp/volume/assets/pic.bin"
    age-keygen -o "$tmp/id.txt" >/dev/null
    recipient="$(age-keygen -y "$tmp/id.txt")"
    export KUMAEDGE_APP_STOPPED=yes
    python3 scripts/volume-backup.py backup "$tmp/volume" "$tmp/v.age" "$recipient"
    python3 scripts/volume-backup.py verify "$tmp/v.age" "$tmp/id.txt"
    python3 scripts/volume-backup.py restore "$tmp/v.age" "$tmp/id.txt" "$tmp/restored"
    cmp "$tmp/volume/kuma.db" "$tmp/restored/kuma.db"
    cmp "$tmp/volume/assets/pic.bin" "$tmp/restored/assets/pic.bin"
  ' || true
else record "Real age encrypted full-volume backup and restore (age/age-keygen/python3 missing)" SKIP; fi

if command -v terraform >/dev/null; then
  for mod in infra/bunny infra/bunny-with-backup; do
    check "Terraform module $mod" "terraform-$(basename "$mod")" bash -c '
      set -euo pipefail
      cd "$1"
      terraform fmt -check -recursive
      terraform init -backend=false -input=false -no-color
      terraform validate -no-color
    ' _ "$mod" || true
  done
else
  record "Terraform module infra/bunny (Terraform not installed)" SKIP
  record "Terraform module infra/bunny-with-backup (Terraform not installed)" SKIP
fi

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  if check "Real Uptime Kuma container build" docker-build docker build --pull -t kumaedge:mac-acceptance .; then
    check "Real HTTP and persistent-volume restart" docker-http bash scripts/smoke-managed.sh kumaedge:mac-acceptance || true
    if command -v age >/dev/null && command -v age-keygen >/dev/null && command -v python3 >/dev/null && command -v node >/dev/null; then
      check "Real isolated encrypted Docker disaster recovery" docker-dr bash scripts/smoke-disaster-recovery.sh kumaedge:mac-acceptance || true
    else record "Real isolated encrypted Docker disaster recovery (missing age/python3/node)" SKIP; fi
  else
    record "Real HTTP and persistent-volume restart (image build failed)" SKIP
    record "Real isolated encrypted Docker disaster recovery (image build failed)" SKIP
  fi
  if check "Backup sidecar image build" backup-build docker build --pull -f Dockerfile.backup -t kumaedge-backup:mac-acceptance .; then
    check "Real backup image age binary" backup-age docker run --rm --entrypoint age kumaedge-backup:mac-acceptance --version || true
  else record "Real backup image age binary (image build failed)" SKIP; fi
else
  record "Real Uptime Kuma container build (Docker Desktop engine unavailable)" SKIP
  record "Real HTTP and persistent-volume restart (Docker Desktop engine unavailable)" SKIP
  record "Real isolated encrypted Docker disaster recovery (Docker Desktop engine unavailable)" SKIP
  record "Backup sidecar image build (Docker Desktop engine unavailable)" SKIP
  record "Real backup image age binary (Docker Desktop engine unavailable)" SKIP
fi

{
  echo "### macOS local acceptance (NOT a GitHub Actions runner)"
  echo
  echo "Source: reviewed PR #34, exact SHA \`$SHA\`."
  echo
  echo "| Test | Result |"
  echo "|---|---|"
  while IFS='|' read -r label status; do
    printf '| %s | %s |\n' "$label" "$status"
  done < "$RESULTS"
  echo
  echo "**PASS=$passes, FAIL=$failures, SKIP=$skips**."
  echo
  echo "No Bunny deployment, paid changes, public HTTPS or production notifications are claimed. Private logs, host identifiers and credentials were not uploaded."
} > "$REPORT"
cat "$REPORT"
echo
echo "Posting only the sanitized summary to PR #34..."
if gh pr comment "$PR" --repo "$REPO" --body-file "$REPORT" >/dev/null; then
  echo "Posted to https://github.com/$REPO/pull/$PR"
else
  echo "Could not post comment; local report is $REPORT" >&2
  failures=$((failures+1))
fi
echo "Logs kept private in $LOGS"
if [ "$failures" -gt 0 ] || [ "$skips" -gt 0 ]; then
  echo "Some acceptance checks failed or could not run; NOT production ready." >&2
  exit 1
fi
echo "All local acceptance checks PASS (real Bunny production still not tested)."
