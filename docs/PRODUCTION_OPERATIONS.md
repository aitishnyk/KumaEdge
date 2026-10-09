# KumaEdge v0.11 — External operations and disaster-recovery acceptance

KumaEdge Managed is a one-replica Uptime Kuma monitoring engine on Bunny Magic Containers. **If KumaEdge itself stops, its internal alerting may stop too**. GitHub Actions offers an independent read-only HTTP + WebSocket observer, which can mark a workflow as failed.

## Configure the independent public observer

1. After deploying a trusted public HTTPS front door and verifying no authenticated responses are shared-cached, set GitHub Actions **repository variable** `KUMAEDGE_PUBLIC_URL` to the HTTPS **origin** (example: `https://status.example.com`). Do not include credentials, tokens, subpaths or query parameters.
2. Run GitHub Actions workflow **KumaEdge - independent public uptime watch** manually and inspect the run. The workflow checks HTTPS landing/cache headers and real Engine.IO polling/WebSocket; it does not log in.
3. Optionally set `KUMAEDGE_REQUIRE_HSTS=true` after your hostname correctly serves HSTS.
4. Set `KUMAEDGE_PUBLIC_WATCH_ENABLED=true`. Only then will the workflow run twice an hour. GitHub schedules are best-effort, may start late or be skipped, and are not a real-time high-availability alerting guarantee. Configure notifications for GitHub failed workflows independently.
5. If running the SQLite backup sidecar, enable the separate [backup freshness observer](BACKUP_MONITORING.md), which checks *metadata* presence, not actual recoverability.

The watcher refuses IP literals and DNS suffixes used for local-only services. **This is not DNS-rebinding protection**: operators must verify DNS routes only to the intended public endpoint. No Bunny credentials are used and no remote writes occur.

## Mandatory production acceptance

The project is **not production ready** before a real Bunny deployment has evidence for each gate:

- [ ] Bunny app created and one writer plus persistent `/app/data` volume verified.
- [ ] HTTPS certificate, WebSocket forwarding and authenticated no-shared-cache behavior independently tested.
- [ ] Admin login, two-factor authentication, session isolation and logout tested.
- [ ] Monitor checks progress with browser closed; a controlled down and recovery sends correct notifications.
- [ ] Restart preserves accounts, monitors, heartbeats and history.
- [ ] Offline, encrypted **whole-volume** backup restored into a separate isolated instance; files outside SQLite verified.
- [ ] For optional Bunny SQLite backup: real remote PUT/GET hash verification, offline `age` decryption and isolated SQLite recovery.
- [ ] Before upgrade, preserve schema-compatible backups and test rollback; switching the old image back does not undo database migrations.
- [ ] Define an on-call owner for red GitHub Action runs, disabled/expired credentials, and backup age/retention costs.

The independent GitHub check observes a public endpoint at one moment only. It neither guarantees continuous uptime nor replaces external incident notification infrastructure. Real Bunny operations and billing were **not** performed as part of source CI.

[Detailed transport acceptance](PRODUCTION_ACCEPTANCE.md) · [Full-volume backup instructions](FULL_VOLUME_BACKUP.md) · [Launch issue #19](https://github.com/aitishnyk/KumaEdge/issues/19).
