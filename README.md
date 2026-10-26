> **v0.20.0 candidate:** integrated optional demo and existing Bunny deployment hardening.
> Owner: https://mc-b4n2u1709h.bunny.run/ · Demo target: /demo (pending deployment).
> See [demo configuration](docs/DEMO_MODE.md), [live gates](docs/BUNNY_LIVE_ACCEPTANCE_REPORT.md)
> and [local release/rollback](docs/V020_RELEASE_AND_ROLLBACK.md). Live readiness is blocked
> until approved app update and real post-update gates. The owner has authorized
> one scoped disposable-data reset; old-data export is no longer a deployment prerequisite.

> **v0.19.0-rc.1 candidate — local Docker release.** Upstream pin: Uptime Kuma 2.5.7.
> Live status: **DEPLOYMENT_BLOCKED**, no verified demo URL yet.
> GitHub Actions workflows are archived; use [local release](docs/LOCAL_DOCKER_RELEASE.md).
> See [actual acceptance](docs/BUNNY_LIVE_ACCEPTANCE_REPORT.md), [upstream audit](docs/UPSTREAM_VERSION_AUDIT.md)
> and [live deployment gates](docs/BUNNY_LIVE_DEPLOYMENT.md). Older CI instructions below are historical.

# KumaEdge

**Run Uptime Kuma on Bunny.net without managing your own VPS.**

A public MIT-licensed project with two tracks:

| Mode | Status | Runtime |
| --- | --- | --- |
| **Bunny Managed** | Upstream Uptime Kuma v2 in a tested Docker image; Terraform installer; live Bunny acceptance required | Paid single-region Bunny Magic Container with persistent SQLite volume |
| **Bunny Edge Preview** | Manual checks only. No background scheduler, persistent history or alerts yet | Stateless Bunny Edge Script |

## Easy installation for Bunny Managed

**[Complete installation guide](docs/BUNNY_TERRAFORM.md)** · [Bunny Manual Setup](docs/BUNNY_MANAGED.md)

1. Install Terraform 1.5+. Clone this repository.
2. Obtain your Bunny account API key and a GitHub `read:packages` token that can pull the KumaEdge container image. Never paste credentials into a public issue or chat.
3. From a **trusted personal terminal**, run `bash scripts/install-bunny.sh`. The script securely prompts for credentials, shows an infrastructure plan and **requires explicit paid-deployment approval**.
4. After provisioning, verify HTTPS, WebSocket, safe caching, persistence and notifications. Optionally store the non-secret `BUNNY_MC_APP_ID` for read-only checks. **Never put your Bunny account key in GitHub Secrets**. See [local-only credentials](docs/BUNNY_LOCAL_CREDENTIALS.md).

The installer provisions one region, one replica, and persistent storage at `/app/data`. It never runs automatically in CI, never uploads Terraform state, and does not hide cloud charges. Local Terraform state must be securely kept and backed up.

## Operational checks and backups

- Public HTTPS and Engine.IO acceptance: `node scripts/check-production.mjs --url https://your-monitor-host`
- Post-install read-only [production acceptance workflow](.github/workflows/production-acceptance.yml): configure `KUMAEDGE_PUBLIC_URL` as a GitHub Actions variable and run manually. This checks HTTPS/cache/WebSocket only; it does not certify account state or backups.
- SQLite verified local snapshots: `python3 scripts/sqlite-snapshot.py /path/to/kuma.db /private/backup/kuma-YYYYMMDD.db`
- [Encrypted offline full-volume backup and safe restore](docs/FULL_VOLUME_BACKUP.md) (requires a stopped writer and authorized filesystem access)
- [Backup and full restore limitations](docs/BACKUP_AND_RECOVERY.md)

A verified SQLite snapshot is **not** a complete `/app/data` backup or proof of disaster recovery on Bunny. Public production access still requires HTTPS and a no-shared-cache frontend.

## Updating and contributing

- [Container build and smoke tests](.github/workflows/bunny-managed-image.yml)
- [Terraform configuration and validation](infra/bunny/)
- [Read-only image release evidence preflight (NO Bunny deployment)](.github/workflows/deploy-managed.yml)
- [Edge-only demo](docs/BUNNY_DEPLOY.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [MIT License](LICENSE)

**Important:** KumaEdge is currently an independent repository, not a GitHub-native fork. The managed image uses original [Uptime Kuma](https://github.com/louislam/uptime-kuma) v2 under MIT; it is not a rewritten backend or an officially endorsed Bunny/Uptime Kuma product. The published GHCR image and local Docker persistence smoke checks do **not** certify a live deployment on any Bunny account.

- [Optional automated age-encrypted Bunny Storage backups of SQLite (not full volume)](docs/BUNNY_SQLITE_OFFSITE_BACKUP.md)

**New installation with the optional encrypted SQLite offsite worker:** `bash scripts/install-bunny.sh --with-backup`. This variant requires a private Bunny Storage Zone and an age public recipient; see [the backup guide](docs/BUNNY_SQLITE_OFFSITE_BACKUP.md).

- [Independent external public HTTPS uptime observer and disaster-recovery runbook](docs/PRODUCTION_OPERATIONS.md) (opt-in; GitHub Actions is not an uptime SLA)

- [Real Docker encrypted full-volume restore certification](docs/REAL_DOCKER_DR_ACCEPTANCE.md) (disposable test volumes; not a live Bunny recovery claim)

- [Pinned image digest and upstream security review workflow](docs/IMAGE_UPDATE_POLICY.md) (reviewed PRs; no unapproved production patching)

**v0.18 credential boundary:** The Bunny Magic Containers action requires an account key rather than an app-scoped sub-user token. All public GitHub workflows verify releases but cannot modify Bunny or access your account API key. [Local deployment and key safety](docs/BUNNY_LOCAL_CREDENTIALS.md).

## v0.20.0 live acceptance

The existing Bunny endpoint runs immutable image source `5c2bd701758944b609dfd588ed12b3f97624c51b`
with original Uptime Kuma 2.5.7. OWNER/TOTP, independent read-only DEMO, HTTPS/WS/CDN,
monitoring, same-volume restart and real Bunny-source encrypted backup/local restore
passed. Readiness: **DEMO_READY**. External notification delivery is NOT_VERIFIED
because no channel is configured; this is not a PRODUCTION_READY claim. See
[the live report](docs/BUNNY_LIVE_ACCEPTANCE_REPORT.md) and
[release/rollback](docs/V020_RELEASE_AND_ROLLBACK.md).
