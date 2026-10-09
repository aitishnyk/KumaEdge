# KumaEdge SQLite snapshots and disaster recovery

**Scope:** the Bunny Managed edition uses the upstream Uptime Kuma SQLite backend stored in a persistent Magic Containers volume at `/app/data`. Losing that volume loses monitor configuration, history and the admin account. A running Magic Container does **not** automatically create offsite backups.

## Database-only snapshot (operator utility)

If you have legitimate filesystem-level access to the volume, use:

```sh
python3 scripts/sqlite-snapshot.py /app/data/kuma.db /private/backups/kuma-YYYYMMDD.db
```

The script uses SQLite's own online backup API, which correctly includes committed WAL transactions. It writes an owner-only temporary copy in the destination directory, verifies SQLite integrity and atomically renames it to a new filename. It never overwrites an existing snapshot and prints SHA-256.

**This tool cannot directly connect to Bunny volume storage.** Do not claim that running it locally accesses Bunny Magic Containers. Your operator must provide a supported secure volume-access/backup mechanism. The repository does not yet provision an automated Bunny offsite backup service.

## Full recovery (required for production)

A database-only snapshot does not include all assets in `/app/data` (such as configured database details or uploaded files). Before upgrades or production use, arrange encrypted, access-controlled **offsite backup of the entire `/app/data` directory**, including all app-managed files, and preserve the Terraform state securely. For a complete filesystem copy, stop the only writer/container before copying, then export every file using a Bunny-supported volume-access mechanism (not implemented by this repository). Test restores in an isolated app.

**Restore sequence:** stop the monitor container; provision the correct single-replica persistent volume; restore *all* files with correct ownership/permissions; restart using a pinned tested image; verify login, 2FA, monitors, historical heartbeats, active schedules and notifications. Do not overwrite the only working volume before verifying an independently restored copy.

## Release gates

- The automated tests exercise a real SQLite database in WAL mode and verify integrity, permissions and collision refusal.
- A passing local snapshot does not certify Bunny account backups, rollback, volume mount continuity, or disaster recovery.
- Do not copy only `kuma.db` while its SQLite WAL is active; this can silently omit committed transactions.
