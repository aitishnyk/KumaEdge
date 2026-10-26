> v0.19 candidate: releases now run locally on the Mac, without GitHub Actions.
> See [Local Docker release](LOCAL_DOCKER_RELEASE.md), [upstream audit](UPSTREAM_VERSION_AUDIT.md),
> [live deployment gates](BUNNY_LIVE_DEPLOYMENT.md) and [rollback](RELEASE_AND_ROLLBACK.md).
> Historical CI/publisher instructions below are retained for older releases and are not current release prerequisites.


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

## Validate an official published release without Bunny access

On a trusted Mac, after a local checkout, run:

    bash scripts/check-local-release.sh FULL_40_CHARACTER_PUBLISHED_MAIN_SHA

This checks a completed successful official main-branch GHCR publishing run and unexpired digest artifact, downloads that artifact into a private temporary directory, signs into GHCR via the existing GitHub CLI token with an ephemeral Docker config, and compares the exact CURRENT registry manifest digests of both primary and backup images. The temporary token/config/evidence directory is deleted. No Bunny key is read, no paid resources are touched. A missing read:packages authorization fails closed. **Source main HEAD is not necessarily a published image tag.**

**macOS Buildx compatibility (v0.18.1):** The read-only release verifier uses plain `docker buildx imagetools inspect IMAGE` and extracts only the root manifest digest before platform details. It deliberately avoids the `--format` flag rejected by some installed Docker versions; missing or ambiguous root digests are fatal. Publisher evidence and BOTH current registry digest checks remain mandatory.

**v0.18.1 — Docker-independent local GHCR verification:** `scripts/check-local-release.sh` now uses the OCI Distribution API at fixed `https://ghcr.io` endpoints; it requires GitHub CLI and Node.js but does not require Docker/Buildx. It requests read-only repository `pull` tokens, preferring anonymous access for public images and using local GitHub CLI credentials only if the package is private. It verifies SHA-256 of the raw root manifest bytes against `Docker-Content-Digest`, then compares BOTH current root digests to the official unexpired publisher evidence. No redirect or Bunny account key is used. A missing/mismatched digest or authorization failure is NOT treated as success.


## GHCR HTTP 403 — different from Bunny credentials

An HTTP 403 from `scripts/check-local-release.sh` after the official publisher artifact is downloaded means **the registry refused access to the image manifest**; it does **NOT** prove an OCI digest mismatch. Publishing images from a public repository does NOT automatically make the GHCR packages public: newly created packages are private by default.

On GitHub, open your own profile → **Packages**, inspect **both** `kumaedge` and `kumaedge-backup` → **Package settings** → package Visibility. If the intent is to offer public MIT open-source images, the owner may explicitly choose **Public** for EACH image after reviewing what the images contain. **Important: changing a package to public is irreversible on GitHub.** This is a manual account security/visibility decision; source code never changes that setting.

If the images must remain **Private**, create a *separate* GitHub personal access token **(classic)** with `read:packages` only, keep it in your own private password manager or Mac Keychain, and pass it to the local release checker through optional `GHCR_READ_TOKEN`. Type it only at a shell hidden prompt or load it from a trusted credential helper; do not paste it into your command history, repository, Issues or chat. The token is transmitted only to fixed HTTPS `ghcr.io/token` when anonymous pull fails. `GHCR_READ_TOKEN` is **NOT the Bunny account key**. Unsetting it in the shell after the check prevents accidentally reusing it for other programs.

Local read-only package verification does not grant permission to create Bunny resources or establish production readiness.
