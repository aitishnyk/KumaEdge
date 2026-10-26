# Live acceptance — v0.20.0 candidate

Overall: **BLOCKED pending owner interaction and full Bunny-source volume export**.
The v0.20 image has not yet been applied. The existing v0.19 engine remains active.
Use the final execution report for the exact candidate SHA/digests and local tests.

Read-only audit found app `E2quWe26NmOfL7q`, one DE pod `gFbzJPmVhSIYqw`, two
containers (kumaedge:3001, owner-gateway:3002), one existing CDN endpoint and Pull
Zone `6868097`. Volume `117a1d40-18e4-4041-b8f7-57e2603cd32a` is 5 GB, instance
`db5c6016-d098-4851-9253-cb2eb581357c`, attached in DE. Only the engine template
mounts it at /app/data. No new resources were requested or created.

The applied private state (serial 3) was copied and SHA-256 verified with a private
backup. Terraform now uses an explicit local backend under
`.local-deployments/E2quWe26NmOfL7q/terraform.tfstate`. A baseline refresh/plan
reported no-op for both existing resources. Legacy source-SHA state must never be
used for another apply. Owner gateway credentials were preserved byte-for-byte.

CDN snapshot/diff was saved privately before modification. Only the existing zone
was updated: SmartCache off, edge/browser TTL zero, errors uncached, cookies kept,
WebSockets retained, one all-routes policy for cache bypass/no-store, HTTPS and
short HSTS. The final API state and original rollback snapshot are private.

| Live gate | Evidence / status |
|---|---|
| Gateway anonymous /setup denied | PASS, external 401 |
| Gateway owner /dashboard | PASS, external 200 with existing private credential |
| Kuma initial setup | Existing admin: needSetup=false; no owner admin session used |
| OWNER admin/TOTP/logout/relogin/expiry | NOT_VERIFIED; protected owner interaction required |
| HTTPS certificate and HTTP redirect | PASS, curl TLS validation and HTTP 301 to same HTTPS host |
| Polling, WebSocket and independent Kuma auth | PASS against current live engine |
| Private no-store / shared cache | PASS on tested current owner/anonymous routes; CDN BYPASS |
| Complete CDN_PHASE_PASS including demo sessions | NOT_VERIFIED until v0.20 live demo tests |
| Public demo login / isolation | NOT_RUN; candidate not deployed |
| Existing SQLite schema/migrations/content | NOT_VERIFIED; no database export access |
| Cloud monitors, browser-closed interval, restart persistence | NOT_RUN; requires owner session and agreed restart |
| External DOWN/UP receipts | NOT_VERIFIED; no authorized external destination/credential provided |
| BUNNY_SOURCE_FULL_BACKUP | NOT_RUN; full /app/data export unavailable through documented public API |
| LOCAL_ISOLATED_RESTORE of Bunny data | NOT_RUN; depends on full Bunny-source backup |
| BUNNY_TO_BUNNY_RESTORE | NOT_RUN; no additional paid app/volume authorized |

The public Magic Containers OpenAPI exposes volume metadata/resize/delete/detach,
app configuration and restart; it does not expose file download, shell exec or
volume backup/export. Do not infer an undocumented endpoint, expose a shell/file
proxy, detach/delete data, use private SQLite as a demo adapter, or create another
paid service to work around this boundary. A supported secure full-volume export
from the owner/platform is required before app update. A Kuma settings export or
local synthetic DR archive is not a full Bunny-source backup.

## Owner steps, after source review

1. Confirm the existing Kuma admin and enable TOTP in the protected HTTPS owner UI.
   Run `python3 scripts/local/owner-live-check.py` directly in a trusted terminal;
   it hides password/TOTP and reports only gate results. No secrets go in chat.
2. Obtain a supported full /app/data export from this exact volume with a
   consistent SQLite snapshot and all assets/configuration. Keep it private;
   encrypt using the existing age full-volume tooling, key stored separately.
   Verify integrity and boot an isolated local Docker restore with the compatible
   image. Record actual user/monitor/history/status-page/asset preservation.
3. Configure demo privately using `scripts/local/configure-demo.py` and identify
   the explicitly public status-page/monitor allowlist.
4. Supply an authorized external notification channel locally; use actual provider
   receipts for both controlled DOWN and recovery.
5. Regenerate the image/config-only plan. Check paired registry evidence, current
   resource IDs, backup receipt, allowed changed fields and exact private diff.
   The apply script requires the human's exact local approval string. Never paste
   or type approval on behalf of the owner. No create/delete/replace, volume,
   endpoint, container count, region or owner-password change is accepted.
6. After authorized apply, execute complete public owner/demo/adversarial/mobile
   tests and agreed restart/persistence interval; re-audit IDs and billing inventory.

Bunny volumes remain node-local without automatic replication or platform backup.
A pod restart is not proof of hardware-loss recovery. Preserve a verified encrypted
Bunny-source archive before any intentional application restart or image update.
