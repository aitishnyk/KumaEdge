#!/usr/bin/env bash
set -euo pipefail

# Deliberately local/interactive: Terraform state can contain GHCR credentials.
# Never run this installer in public CI or send plan/state files as artifacts.
if [[ -n "${CI:-}" || ! -t 0 ]]; then
  echo "KumaEdge setup requires a trusted interactive terminal, not public CI." >&2
  exit 2
fi
if ! command -v terraform >/dev/null 2>&1; then
  echo "Terraform 1.5+ is required. See https://developer.hashicorp.com/terraform/install" >&2
  exit 2
fi
backup_mode=false
case "${1:-}" in
  "") ;;
  "--with-backup") backup_mode=true ;;
  "--help"|"help")
    echo "Usage: bash scripts/install-bunny.sh [--with-backup]"
    exit 0
    ;;
  *) echo "Unknown option: $1" >&2; exit 2 ;;
esac
if [[ "$backup_mode" == "true" ]]; then
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../infra/bunny-with-backup" && pwd)"
else
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../infra/bunny" && pwd)"
fi
cd "$root"
umask 077

echo "KumaEdge — Bunny Magic Containers installer"
echo "This deploys PAID single-region compute and 5 GB persistent storage."
echo "Keep terraform.tfstate and any credentials PRIVATE and backed up."
echo "Do not run if you already deployed this app without importing its state."

if [[ -z "${BUNNYNET_API_KEY:-}" ]]; then
  read -r -s -p "Bunny account API key (input hidden): " BUNNYNET_API_KEY
  echo
fi
if [[ -z "${TF_VAR_ghcr_read_token:-}" ]]; then
  read -r -s -p "GitHub read:packages token for pulling GHCR (input hidden): " TF_VAR_ghcr_read_token
  echo
fi
if [[ -z "${TF_VAR_ghcr_username:-}" ]]; then
  read -r -p "GitHub registry username: " TF_VAR_ghcr_username
fi

# Refuse to silently install an outdated, hard-coded image tag.
# Only use the exact SHA printed by a successful main-branch GHCR publish.
if [[ -z "${TF_VAR_image_tag:-}" ]]; then
  echo "Open https://github.com/aitishnyk/KumaEdge/actions/workflows/bunny-managed-image.yml"
  read -r -p "Enter a successfully published image tag (40-character commit SHA): " TF_VAR_image_tag
fi
if [[ ! "$TF_VAR_image_tag" =~ ^[a-f0-9]{40}$ ]]; then
  echo "Expected a verified published 40-character lowercase SHA; no resources created." >&2
  exit 2
fi
export TF_VAR_image_tag

if [[ -z "$BUNNYNET_API_KEY" || -z "$TF_VAR_ghcr_read_token" || -z "$TF_VAR_ghcr_username" ]]; then
  echo "Missing credentials or registry username; no resources created." >&2
  exit 2
fi
if [[ "$backup_mode" == "true" ]]; then
  echo "Optional backup sidecar adds a second container and needs an EXISTING private Bunny Storage Zone."
  echo "Only SQLite is backed up online. All Terraform state and credentials remain your responsibility."
  if [[ -z "${TF_VAR_backup_storage_zone:-}" ]]; then
    read -r -p "Existing private Bunny Storage Zone name: " TF_VAR_backup_storage_zone
  fi
  if [[ -z "${TF_VAR_backup_storage_access_key:-}" ]]; then
    read -r -s -p "Storage Zone write password (input hidden): " TF_VAR_backup_storage_access_key
    echo
  fi
  if [[ -z "${TF_VAR_backup_age_recipient:-}" ]]; then
    read -r -p "age PUBLIC recipient (age1...): " TF_VAR_backup_age_recipient
  fi
  if [[ -z "${TF_VAR_backup_storage_zone:-}" || -z "${TF_VAR_backup_storage_access_key:-}" ||
        ! "${TF_VAR_backup_age_recipient:-}" =~ ^age1[023456789acdefghjklmnpqrstuvwxyz]{25,130}$ ]]; then
    echo "Missing/invalid SQLite backup configuration. Nothing created." >&2
    exit 2
  fi
  export TF_VAR_backup_storage_zone TF_VAR_backup_storage_access_key TF_VAR_backup_age_recipient
  echo "IMPORTANT: confirm both the main and backup GHCR images exist for the SHA selected."
fi
export BUNNYNET_API_KEY TF_VAR_ghcr_read_token TF_VAR_ghcr_username

# Keep temporary registry credentials and Terraform plan off disk after any exit.
plan=""
release_docker_config=""
cleanup() {
  if [[ -n "$plan" ]]; then rm -f -- "$plan"; fi
  if [[ -n "$release_docker_config" ]]; then rm -rf -- "$release_docker_config"; fi
  unset BUNNYNET_API_KEY TF_VAR_ghcr_read_token TF_VAR_ghcr_username TF_VAR_image_tag TF_VAR_backup_storage_zone TF_VAR_backup_storage_access_key TF_VAR_backup_age_recipient
}
trap cleanup EXIT

# v0.17 opt-in digest pinning must be backed by exact SHA publisher evidence.
# This is deliberately BEFORE any Terraform init, plan or paid apply.
if [[ -n "${TF_VAR_image_digest:-}" || -n "${TF_VAR_backup_image_digest:-}" ]]; then
  if [[ "${KUMAEDGE_RELEASE_EVIDENCE_FILE:-}" != /* ||
        ! -f "${KUMAEDGE_RELEASE_EVIDENCE_FILE:-}" ]]; then
    echo "Digest pinning requires KUMAEDGE_RELEASE_EVIDENCE_FILE as an absolute path to publisher evidence.json; no resources created." >&2
    exit 2
  fi
  for binary in node docker; do
    if ! command -v "$binary" >/dev/null 2>&1; then
      echo "$binary is required to verify OCI digest pins; no resources created." >&2
      exit 2
    fi
  done
  release_docker_config="$(mktemp -d "${TMPDIR:-/tmp}/kumaedge-ghcr.XXXXXXXX")"
  chmod 0700 "$release_docker_config"
  printf '%s' "$TF_VAR_ghcr_read_token" |
    docker --config "$release_docker_config" login ghcr.io --username "$TF_VAR_ghcr_username" --password-stdin >/dev/null
  DOCKER_CONFIG="$release_docker_config" \
  KUMAEDGE_GHCR_REPOSITORY="${TF_VAR_image_namespace:-aitishnyk}/${TF_VAR_image_name:-kumaedge}" \
  KUMAEDGE_BACKUP_MODE="$backup_mode" \
  node "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/preflight-bunny-install.mjs" "$KUMAEDGE_RELEASE_EVIDENCE_FILE"
  rm -rf -- "$release_docker_config"
  release_docker_config=""
fi

plan="$(mktemp "$root/.kumaedge-plan.XXXXXXXX")"
terraform init -input=false
terraform fmt -check -recursive
terraform validate -no-color
terraform plan -input=false -out="$plan"
terraform show -no-color "$plan"
echo
echo "Review the full plan above. PAID resources may be created and charged."
read -r -p 'Type CREATE KUMAEDGE to authorize terraform apply: ' confirmation
if [[ "$confirmation" != "CREATE KUMAEDGE" ]]; then
  echo "Cancelled safely; nothing applied."
  exit 3
fi
terraform apply -input=false "$plan"
echo
echo "Provision request completed. Bunny live acceptance is still required."
terraform output app_id
terraform output next_steps
echo "Set BUNNY_MC_APP_ID in the GitHub repository's Actions variables."
echo "Verify HTTPS + zero shared caching of authenticated routes + WebSocket."
echo "Then initialize 2FA and monitor recovery tests; preserve state and backups."
