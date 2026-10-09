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

## v0.10 — Production front door and backup freshness
- [x] Explicit HTTPS/WebSocket/cache/HSTS deployment audit
- [x] Private Bunny Storage backup freshness observer, disabled until opt-in
- [ ] Real HTTPS public deployment and actual rollback/restore evidence

## v0.11 — Independent production operations
- [x] Opt-in, external scheduled HTTPS + Engine.IO polling/WebSocket observer
- [x] Fail-closed public DNS hostname requirement in production audit
- [x] Operations and disaster-recovery acceptance runbook
- [ ] Live public URL acceptance from independent runner
- [ ] Real Bunny monitoring/alert delivery, persistent restart and isolated restore tests

## v0.12 — Real-container full-volume recovery
- [x] Actual Uptime Kuma Docker database and extra file backed up offline with age
- [x] Restored into a fresh Docker volume and booted in another Uptime Kuma container
- [x] Full-volume integrity check blocks GHCR publishing if recovery fails
- [ ] Real Bunny production export, offsite full-volume storage and isolated restore acceptance

## v0.14 — Release provenance and GHCR fail-closed deployment
- [x] Check exact official successful main-branch image publishing run before Bunny update
- [x] Reject missing Bunny connection, ambiguous registry response and partial two-image release
- [x] Limit GHCR tag publishing concurrency to one writer per Git SHA
- [x] Test GHCR 403/timeout vs genuine missing-manifest behavior
- [ ] Real GitHub production environment credentials and live Bunny deployment
- [ ] Cryptographic OCI release attestation / signed digest pinning in Bunny runtime

## v0.15 — Published OCI digest admission evidence
- [x] Create a per-run GitHub artifact with both registry OCI manifest digests only after actually publishing the two tested GHCR images
- [x] Require evidence from a successful official main-branch push run and compare BOTH live registry digests before Bunny mutation
- [x] Fail closed on absent/expired artifact, missing backup tag, registry errors and tag retargeting
- [ ] Replace tag-based Bunny update with digest-addressed image update if Bunny API supports it
- [ ] Signed SLSA/OCI attestation and independent supply-chain verification
