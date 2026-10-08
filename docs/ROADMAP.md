# Roadmap

All entries are **planned** unless marked implemented.

## v0.1 — foundation

- [x] Public open-source repository foundation and MIT license
- [x] Initial CI and source tests for the portable HTTP status classifier
- [x] Daily upstream metadata watcher creating reviewable PRs
- [ ] Vue/Vite dashboard
- [ ] Bunny static hosting deploy workflow
- [ ] Bunny Edge Scripts adapter and authenticated API

## v0.2 — reliable monitors

- [ ] Durable monitor configuration and heartbeat persistence
- [ ] Scheduled HTTP(S) checks with proven periodic dispatch
- [ ] SSRF-safe DNS, redirect and destination validation
- [ ] State machine for incidents, retries and recovery
- [ ] Time-series rollups

## v0.3 — notifications and status

- [ ] Telegram, email and webhook integrations
- [ ] Public status pages and incident history
- [ ] TLS expiry checks, verified regional checks
- [ ] Restore, backup and export

## v1.0 — production gates

- [ ] End-to-end deployment tested on Bunny.net
- [ ] Secure authorization, threat model, and key rotation
- [ ] Concurrency, race, load and data retention validation
- [ ] One-command assisted setup and clear pricing documentation
- [ ] Upstream vulnerability applicability tracked to resolution
