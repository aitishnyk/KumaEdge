# v0.10 — Opt-in encrypted SQLite backup freshness monitoring

The backup worker can send age-encrypted **SQLite-only** snapshots to a private Bunny Storage Zone. This opt-in observer detects a stopped worker or stale/absent backup objects by listing the most recent dated folders through the official Bunny Storage API.

This is a **metadata presence and freshness** check, not a checksum verification or restore drill. A fresh object can still be undecryptable, so you must periodically test an isolated restore using the offline recovery scripts. Do not interpret this health check as proof of a complete backup of `/app/data`.

## Configure the optional GitHub Actions observer

1. Deploy and verify the two-container installation described in [BUNNY_SQLITE_OFFSITE_BACKUP.md](BUNNY_SQLITE_OFFSITE_BACKUP.md).
2. In GitHub → Repository Settings → Secrets and Variables → Actions, create the Actions **secret** `KUMAEDGE_STORAGE_ACCESS_KEY` with the private Storage Zone key. It is separate from `BUNNYNET_API_KEY`. Avoid publicly exposing this key, logs, and Terraform state.
3. Configure Actions **variables** `KUMAEDGE_STORAGE_ZONE` and `KUMAEDGE_STORAGE_REGION` (e.g. `de`), plus optional `KUMAEDGE_BACKUP_MAX_AGE_HOURS` (default `36`, permitted `6–168`).
4. Only after the first verified upload exists, set `KUMAEDGE_BACKUP_MONITOR_ENABLED=true`. This activates [the scheduled freshness workflow](../.github/workflows/backup-freshness.yml) every six hours. Run it manually once before relying on the scheduled checks.
5. Review failing GitHub Actions jobs; configure notification preferences in GitHub, since a failed workflow does not deliver KumaEdge's own Telegram alerts.

The monitor checks a bounded number of dated directories, validates object naming and size, compares Bunny's `DateCreated` metadata with the encoded timestamp and current UTC time, and fails when no eligible backup is fresher than the threshold. It performs only authenticated HTTPS GET directory listings; no deletion, upload or download of file contents. Bunny may return date strings without timezone offsets; this implementation interprets such dates as UTC, which should be verified against your Storage Zone's returned format during live acceptance.

## Boundaries and costs

- GitHub Actions is an **independent optional observer**, not a Bunny-native scheduler. GitHub schedule reliability and notification delivery are separate dependencies.
- A fail/no-permission/oversized listing is not silently reported as healthy.
- Backup data is never published in GitHub logs. No storage access key is accepted in command-line arguments.
- This scheduled external observer is **disabled by default**. A running worker and correct Storage Zone configuration must be verified first.
- Consider private Storage Zone access-key scope and operational cost; plan retention, offsite key recovery and independent testing before production.
