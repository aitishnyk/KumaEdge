# v0.20.0 release and rollback

Run the existing local Mac pipeline on an exact clean commit, with Node 22+ and age:
`doctor.sh`, `test.sh`, `build.sh`, `verify.sh`, then `publish.sh --keychain`.
No GitHub Actions workflow, runner, CodeQL job or CI result is part of this release. Repository-level Actions permission is disabled, including dynamic jobs; CodeQL default setup remains not-configured.
Publication must preserve paired immutable source-SHA tags for main and backup,
verify remote OCI digests and pull the exact images back for identity comparison.
The backup image is not deployed as a third cloud container.

The live app still uses the v0.19 paired release until an approved update passes
its independent backup gate. The immutable main reference is
`ghcr.io/aitishnyk/kumaedge:21febcb9e2bdd4bb88f3d374b9dc59d451e80d01`
at `sha256:23ba069c5e5b2233a9c5df2aa62b7c9d681f4e135cc08024987b5652b0bec9e7`.
Uptime Kuma stays pinned to 2.5.7; this candidate changes gateway/application
configuration, not the engine version or intended database schema.

Never roll back an engine against a database migrated by a newer incompatible
engine. Restore a verified pre-upgrade full-volume archive into a separate local
volume first; do not delete/detach/replace the live Bunny volume. Any destructive
cloud restore requires separate owner authorization. A same-version gateway image
rollback still needs a reviewed existing-resource plan and local owner approval.

Private deployment files (state, secrets, before/after CDN snapshots, saved plans)
remain under `.local-deployments/<app-id>`; revision-specific build logs/evidence
remain under `.local-release/<sha>`. Both are ignored by Git and Docker context.
The local backend is not encrypted at rest; protect the Mac and its backups.
Copies of legacy state are archival only. Reconcile using
`python3 scripts/local/reconcile-state.py /absolute/legacy/terraform.tfstate`, then
verify a no-op baseline before editing resources. The helper refuses divergent
existing state instead of overwriting it.

For CDN rollback, review `cdn-original.private.json` against current zone settings
and restore only the changed cache/TLS fields/rule on Pull Zone 6868097. Removing
no-store or HTTPS protection is a security regression, not a default rollback.
Do not post the full private zone JSON or reuse it to create another zone.
