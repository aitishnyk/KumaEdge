#!/usr/bin/env bash
set -euo pipefail

# Deliberately local/interactive: Terraform state can contain GHCR credentials.
# Never run this installer in public CI or send plan/state files as artifacts.
if [[ -n "\${CI:-}" || ! -t 0 ]]; then
  echo "KumaEdge setup requires a trusted interactive terminal, not public CI." >&2
  exit 2
fi
if ! command -v terraform >/dev/null 2>&1; then
  echo "Terraform 1.5+ is required. See https://developer.hashicorp.com/terraform/install" >&2
  exit 2
fi
root="$(cd "$(dirname "\${BASH_SOURCE[0]}")/../infra/bunny" && pwd)"
cd "$root"
umask 077

echo "KumaEdge — Bunny Magic Containers installer"
echo "This deploys PAID single-region compute and 5 GB persistent storage."
echo "Keep terraform.tfstate and any credentials PRIVATE and backed up."
echo "Do not run if you already deployed this app without importing its state."

if [[ -z "\${BUNNYNET_API_KEY:-}" ]]; then
  read -r -s -p "Bunny account API key (input hidden): " BUNNYNET_API_KEY
  echo
fi
if [[ -z "\${TF_VAR_ghcr_read_token:-}" ]]; then
  read -r -s -p "GitHub read:packages token for pulling GHCR (input hidden): " TF_VAR_ghcr_read_token
  echo
fi
if [[ -z "\${TF_VAR_ghcr_username:-}" ]]; then
  read -r -p "GitHub registry username: " TF_VAR_ghcr_username
fi

if [[ -z "$BUNNYNET_API_KEY" || -z "$TF_VAR_ghcr_read_token" || -z "$TF_VAR_ghcr_username" ]]; then
  echo "Missing credentials or registry username; no resources created." >&2
  exit 2
fi
export BUNNYNET_API_KEY TF_VAR_ghcr_read_token TF_VAR_ghcr_username

plan="$(mktemp "$root/.kumaedge-plan.XXXXXXXX")"
cleanup() {
  rm -f -- "$plan"
  unset BUNNYNET_API_KEY TF_VAR_ghcr_read_token TF_VAR_ghcr_username
}
trap cleanup EXIT

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
