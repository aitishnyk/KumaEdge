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
4. After provisioning, verify CDN caching is disabled for logged-in/dynamic routes, HTTPS, WebSocket, data persistence on restarts and alerts. Configure a protected production environment and `BUNNY_MC_APP_ID` for later image updates.

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
- [Manual reviewed production image rollout](.github/workflows/deploy-managed.yml)
- [Edge-only demo](docs/BUNNY_DEPLOY.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [MIT License](LICENSE)

**Important:** KumaEdge is currently an independent repository, not a GitHub-native fork. The managed image uses original [Uptime Kuma](https://github.com/louislam/uptime-kuma) v2 under MIT; it is not a rewritten backend or an officially endorsed Bunny/Uptime Kuma product. The published GHCR image and local Docker persistence smoke checks do **not** certify a live deployment on any Bunny account.

- [Optional automated age-encrypted Bunny Storage backups of SQLite (not full volume)](docs/BUNNY_SQLITE_OFFSITE_BACKUP.md)
