
# KumaEdge — Bunny Account API Key: local-only security policy (v0.18)

**NEVER place or store your primary Bunny Account API Key in this public GitHub repository, Issues, PRs, commit history, GitHub Actions Secrets, Environment Secrets, variables, artifacts, logs or chat.** Neither maintainers nor community testers need your key.

## Why not even GitHub Environment Secrets?

The [official Bunny Magic Containers GitHub action documentation](https://docs.bunny.net/docs/magic-containers-github-action) says the deployment action requires an account API key and does NOT support sub-user accounts. We cannot claim app-scoped permissions are available for that action. A GitHub Secret is encrypted at rest, but its value is made available to selected jobs and to code they execute. Environment approvals do not limit the permissions of an account-wide key.

Therefore all KumaEdge public workflows are deliberately **read-only with respect to Bunny**. The workflow in .github/workflows/deploy-managed.yml still verifies the official main image publishing run, artifact and current GHCR digests; despite its historical filename it does NOT deploy. The Bunny access preflight checks only non-secret metadata.

## Where to put the key

Keep your Bunny Account API Key in a personal password manager. Use it **only from a trusted local terminal** on your Mac, never as a GitHub repository or environment secret. From an exact reviewed SHA of the project and after inspecting the installer, run:

    bash scripts/install-bunny.sh

The installer prompts for "Bunny account API key (input hidden)" through a hidden read. Paste the secret **at that prompt**, not into a command line or shell-history expression. It does not ask you to save the account key in files. Terraform temporarily reads BUNNYNET_API_KEY from the local environment during the single interactive process. Never paste the value into a public chat.

The installer separately requests a **GitHub read:packages token** and username to pull the GHCR image. Do not confuse that token with the Bunny Account API Key.

If you want stronger isolation of account impact, you can consider creating a completely separate Bunny account just for KumaEdge under your own control. This is a manual account and billing decision; sub-user credentials cannot be presumed sufficient for the official deployment action.

## Paid resource consent and secret-bearing state

The script provisions a **new paid** single-region Magic Container with a persistent volume and refuses non-interactive/CI execution. It shows the entire Terraform plan and only runs apply after you personally type CREATE KUMAEDGE. **Never rerun the new-install script against an already provisioned app** without carefully importing/reconciling its prior state.

Terraform state can contain sensitive **GHCR token**, optional Bunny Storage Zone credentials and other resource data. Keep the state local and private with restricted filesystem permissions and encrypted private backup. Never commit it, share it publicly or upload it as a GitHub artifact.

For a first install, select a SHA whose official main-branch GHCR publishing workflow successfully pushed both images. A source main SHA is NOT necessarily a published image SHA. Strict OCI image pinning requires the artifact evidence file, matching digest variables and read-only GHCR verification before the paid plan. See [Terraform installation](BUNNY_TERRAFORM.md).

## Existing deployments and production acceptance

For updates, retain the existing Terraform state, a schema-compatible **whole-volume encrypted backup**, a reviewed image SHA/digest, and inspect a **local** Terraform plan for unexpected app/volume replacement. Do not use a fresh install command as an upgrade. Do not presume database migrations can be reversed by rolling back the Docker tag.

Public GitHub can verify release images, GHCR evidence, unauthenticated HTTPS/WebSocket and backup freshness without the account key. It CANNOT mutate Bunny resources and must not be configured to do so with the primary Bunny key.

The source work alone proves neither Bunny billing approval nor live HTTPS, alerts, persistent restarts or recovery. See [real production acceptance #19](https://github.com/aitishnyk/KumaEdge/issues/19) and [hosted runner allocation #35](https://github.com/aitishnyk/KumaEdge/issues/35).
