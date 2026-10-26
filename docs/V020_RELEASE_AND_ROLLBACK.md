# v0.20.0 release and rollback

Run the existing local Mac pipeline on an exact clean commit, with Node 22+ and age:
`doctor.sh`, `test.sh`, `build.sh`, `verify.sh`, then `publish.sh --keychain`.
No GitHub Actions workflow, runner, CodeQL job or CI result is part of this release. Repository-level Actions permission is disabled, including dynamic jobs; CodeQL default setup remains not-configured.
Publication must preserve paired immutable source-SHA tags for main and backup,
verify remote OCI digests and pull the exact images back for identity comparison.
The backup image is not deployed as a third cloud container.

The accepted live runtime image source is
`5c2bd701758944b609dfd588ed12b3f97624c51b`, Uptime Kuma 2.5.7 unchanged.
Main OCI digest: `sha256:55b4f8a88396fa6b75163ee41c94c2cf0926e60a46cff8986913eb4ea3c99c48`.
Backup OCI digest: `sha256:0b2c35cba40672523730217e39a701257ec9ef14ae7fdb561b0f4a044c881d22`.
The final docs/operator-harness commit can differ from this immutable image SHA;
check the deployed source/digest evidence instead of assuming main HEAD is an image tag.
Live owner/demo/transport/persistence and actual Bunny backup/local restore PASS.
Readiness is DEMO_READY; external notifications are NOT_VERIFIED by owner choice.

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

Provider 0.19.1 reports the computed endpoint ID as unknown during any app update.
The guard permits only this metadata unknown with the exact provider marker while
requiring the endpoint name/type/port and existing computed Pull Zone ID to remain
identical. Every other endpoint field is compared. The existing endpoint ID and
hostname must be checked again against Bunny immediately before and after apply;
this computed unknown alone is not evidence of a replacement or a new Pull Zone.

## Owner-authorized disposable test initialization

The owner subsequently authorized discarding only the contents of the existing
5GB /app/data volume. The old-data-export gate is waived for this specific initial
update and recorded separately from PASS. The authorization binds app ID, volume
ID, old image digest and one reset nonce; it is consumed after apply. Container
count, actual volume and endpoint IDs remain pinned. The only additional allowed
main-container changes are the fixed engine supervisor command and its explicit
operations/recipient/reset environment keys. Existing owner gateway credentials
and infrastructure state are preserved. Future updates require a real backup.

After the human approves the exact reviewed image/config/reset plan in the local
terminal, run `python3 scripts/local/live-acceptance.py`. This waits for the actual
candidate OCI digest, initializes the disposable dataset through genuine Kuma
setup and TOTP APIs, keeps new owner/factor secrets in Keychain, creates three
explicit acceptance monitors/public labels, checks public demo isolation and
WebSocket reconnect, waits with operator clients closed, exports/locally restores
the full actual Bunny volume, and checks an agreed same-volume app restart.
External notification receipts remain NOT_VERIFIED without an authorized channel.

## Live findings and provider recovery

The owner-approved a315114 update was accepted by Bunny, despite the provider's
inconsistent-result error from reordering gateway environment variables. Keep a
private copy of the resulting state. Use ONE sorted dynamic environment block
for both the owner credential and demo keys; then use refresh-only to reconcile
state and require a normal no-op plan. Do not reapply a stale saved plan or reset
application data again. Preserve the existing nonce and on-volume completion marker.

Operator acceptance tools resolve the actual deployed SHA/digest against local
publisher evidence. A later documentation or infrastructure commit does not imply
that its SHA is deployed. Missing, mixed or mismatched release evidence fails closed.
Bunny's POST 303 responses may omit CDN-Cache; no-store/no Age and uncached GET
session-isolation checks remain required.
