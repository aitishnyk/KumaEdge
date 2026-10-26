# Live acceptance report — v0.19 candidate

**DEPLOYMENT_BLOCKED**. There is no KumaEdge Bunny App ID or verified public URL.
No live gate is claimed from local tests. See final execution evidence for local results.

| Gate | Result |
|---|---|
| Registry publication / remote digest equality | NOT_RUN |
| Paid Terraform plan / apply | NOT_RUN |
| Bunny HTTPS / certificate / redirect | NOT_RUN |
| Bunny polling / WebSocket | NOT_RUN |
| Bunny 2FA / session / shared cache isolation | NOT_RUN |
| Bunny monitor and heartbeat persistence after restart | NOT_RUN |
| External DOWN/UP notification receipts | NOT_RUN |
| Complete Bunny volume encrypted restore | NOT_RUN |

Local runtime and recovery evidence is distinct from this table. Fixture webhook
receipts prove only local delivery to the controlled receiver. An external provider
needs owner-authorized credentials and destination supplied privately in a terminal.

## Local audit results (separate from Bunny)

| Test | Result |
|---|---|
| Node regression | PASS: 82 tests on Node 22 |
| Python regression including actual age encryption | PASS: 36 tests, no skips |
| Terraform init/fmt/validate, both modules | PASS |
| Main and backup Linux/AMD64 Docker builds | PASS |
| Real Kuma HTTP, polling and WebSocket | PASS |
| Auth session isolation and TOTP enrollment/login | PASS |
| Controlled HTTP/TCP monitoring and heartbeat history | PASS |
| Controlled local webhook DOWN/UP delivery | PASS |
| Same-volume restart and history preservation | PASS |
| 2.5.6 → 2.5.7 migration with record preservation | PASS |
| Trusted TLS/STARTTLS with real upstream implementation | PASS |
| Untrusted self-signed certificate | Rejected as expected; #8019 compatibility change documented |
| Encrypted complete-volume restore and isolated Kuma boot | PASS: users, monitors, history and extra files preserved |
| Owner gateway HTTP/upgrade regression | PASS in Node; exact release Docker retest required |

These are development audit results. Final release evidence must be generated
again for the exact committed source and image IDs before publication. Tests that
failed during harness development were corrected and rerun; no failed run is used
as release proof. Notification delivery here is local, not an external live channel.
