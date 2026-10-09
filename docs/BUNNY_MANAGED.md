# KumaEdge Bunny Managed Installation

KumaEdge Bunny Managed defaults to SQLite via the supported `UPTIME_KUMA_DB_TYPE=sqlite` environment variable, bypassing the initial database-type picker on a fresh volume. **Do not reuse this image for an existing MariaDB installation without adjusting the configuration and migration plan.**\n\nKumaEdge Bunny Managed runs the **full original Uptime Kuma v2** monitoring engine, notification providers, incident history and browser interface on a **paid** Bunny Magic Containers instance. No self-managed VPS is needed, but a paid running container and durable volume are required.

## Recommended provisioning

Use [the official Terraform-based reproducible installer](BUNNY_TERRAFORM.md) from a trusted computer:

```bash
bash scripts/install-bunny.sh
```

The interactive installer checks required Terraform commands, asks for credentials without echoing them, prepares a plan, and requires typing `CREATE KUMAEDGE` before creating any paid resources. Neither GitHub Actions nor this repository automatically creates paid Bunny resources.

## Existing deployment / manual setup

If you already provisioned a Bunny Magic Container, **do not run the Terraform installer against it without importing state**. Configure exactly one replica and one region, a persistent volume mounted at `/app/data`, container name `kumaedge`, port `3001`, and an HTTPS frontend that forwards authenticated requests and WebSockets without sharing cached data. Restore backups before risky upgrades.

## Images and updates

A passing GitHub workflow builds and tests `louislam/uptime-kuma:2`, then publishes its exact tested image under the main-branch SHA to `ghcr.io/aitishnyk/kumaedge:<SHA>`. Upstream image updates are rebuilt on a reviewed change; no moving :2 is automatically pushed to production.

After first-time provisioning, configure:
- GitHub Actions Secret `BUNNYNET_API_KEY`.
- GitHub Actions Variable `BUNNY_MC_APP_ID`.
- A protected `production` environment for the explicit update workflow.

The manual update workflow validates the image's exact 40-hex SHA, confirms its lineage in main, verifies GHCR access and then invokes Bunny's pinned action to update the existing container.

## Live checks required

The default Anycast endpoint does not itself guarantee TLS; provide an HTTPS front door before entering credentials. Run `node scripts/check-production.mjs --url https://your-public-host` for a fail-closed anonymous transport and cache audit. Verify the public endpoint with HTTPS; test browser login + Socket.IO transport; disable CDN shared caching for sessions, API, HTML and dynamic status; enable 2FA; test actual down/recovered alerts and SQLite state after a container restart; preserve private encrypted backups.

The Terraform provider's successful schema validation and GitHub Docker smoke are **not** evidence that live Bunny account integration has run.

References:
- https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app
- https://docs.bunny.net/docs/magic-containers-github-action
