# KumaEdge roadmap and release gates

## v0.1 — Foundation
- [x] MIT open-source project, CI, upstream watch and contribution policies

## v0.2 — Standalone Edge preview
- [x] Stateless Bunny Edge Script demo with manual HTTP checks
- [x] Static dashboard and deployment documentation
- [ ] Durable serverless scheduler and storage backend (separate, not production ready)

## v0.3 — Incident logic
- [x] Deterministic incident state machine and observed-sample rollups (prototype)
- [x] Atomic storage contract
- [ ] Persistent Edge Script integration (not shipped)

## v0.4 — Bunny Managed
- [x] Full Uptime Kuma v2 container instead of rewritten backend
- [x] Single replica/region with persistent volume and Terraform provisioning
- [x] Real Docker startup, Engine.IO smoke and volume persistence tests
- [x] Immutable SHA-tagged GHCR image publishing and manual approval-based updates
- [ ] Live Bunny deploy and account-scoped acceptance

## v0.5 — Production acceptance/security
- [x] Local SQLite online snapshot and integrity tests
- [x] HTTPS and HTML/polling cache policy preflight
- [x] Real Engine.IO WebSocket handshake acceptance
- [x] Bounded response and TLS-only production checks
- [x] Read-only GitHub Actions audit using KUMAEDGE_PUBLIC_URL
- [ ] Real public HTTPS frontend and access control acceptance
- [ ] Verify notification alerts, persistence after restart and independent full-volume restore on Bunny
- [ ] Automate verified secure offsite backup/restore and database-aware migrations

## v1.0 — Product acceptance
- [ ] All required live gates green in a real Bunny account
- [ ] Installation and rollback instructions verified externally
- [ ] Security review, operational health and recovery exercise

## v0.7 — Optional SQLite offsite backup
- [x] Opt-in pod sidecar, SQLite online consistent copy including committed WAL
- [x] age encryption with remote Bunny Storage PUT and authenticated GET SHA-256 readback
- [x] Exact tagged, tested backup-worker GHCR image and Terraform settings
- [ ] Live Bunny Storage write/read test and real isolated restore drill
- [ ] Full-volume automated online backup, retention, alerting and recovery runbooks
