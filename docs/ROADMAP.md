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
- [x] Add optional authenticated Docker Hub base pulls with pairwise credential validation (mitigates shared-runner anonymous HTTP 429)
- [ ] Configure private Docker Hub read-only Actions credentials for rate-limit-resistant build acceptance

## v0.16 — Optional Terraform digest pins (source only)
- [x] Support optional `image_digest` in provider 0.19.1 for the normal single-container module
- [x] Support validated main/backup digest pair in the optional offsite backup module
- [x] Keep interactive paid-plan consent and document artifact-based digest selection
- [ ] Prove digest enforcement, restarts and rollback on a real Bunny app
- [ ] Replace tag-only update path with a tested digest-native rollout before claiming end-to-end immutability

## v0.17 — Verified OCI pinning at install time (source)
- [x] Fail-closed read-only publisher artifact, both-registry-manifests and Terraform digest verification before paid installer plan/apply
- [x] GHCR read-only token scoped to disposable Docker credential directory; no persistent local Docker login side effect
- [x] Negative tests for retargeted images, bad artifact, unpaired backup pins and registry failures
- [ ] Run authenticated end-to-end digest-pinned installation and rollback on a real Bunny account

## v0.18 — Public-repository Bunny account key isolation (source)
- [x] Remove account key inputs and Bunny mutation actions from all public GitHub workflows
- [x] Preserve SHA, publisher and GHCR digest release verification as a read-only workflow
- [x] Bunny preflight uses non-sensitive app metadata only
- [x] Add regression checks prohibiting Bunny account keys and deploy actions in workflows
- [x] Document hidden-prompt local install, Terraform state sensitivity and paid confirmation
- [ ] Hosted GitHub runners/CodeQL fully green (issue #35)
- [ ] Live paid Bunny HTTPS, alerts, durable restarts and isolated recovery acceptance (issue #19)

## v0.18.1 — macOS symlink-safe local release CLI

- [x] Diagnose Node CLI guard /var -> /private/var realpath mismatch causing silent exit 0
- [x] Resolve direct CLI entrypoints with filesystem realpath and safe file URL conversion across all four affected scripts
- [x] Add symlink and import-only regression tests, plus fail-closed empty publisher proof diagnostics
- [ ] Verify full exact-tree regression and live read-only GHCR release check on operator Mac (no Bunny key)
- [ ] GitHub-hosted Actions runner allocation and live Bunny deployment remain separate gates
