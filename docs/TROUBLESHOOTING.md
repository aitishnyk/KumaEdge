# Troubleshooting

| Symptom | Check |
|---|---|
| OWNER Basic challenge | Gateway username `owner` and its separate private password |
| Upstream login rejected | Original admin username/password; not DEMO or gateway credentials |
| TOTP rejected | Current authenticator enrollment and device time; never reset automatically |
| DEMO 401 | Correct mode/verifier, demo username, origin and session expiry |
| DEMO 403 | Fresh CSRF cookie/form and exact HTTPS Origin |
| DEMO 429/503 | Bounded rate/session capacity; private mode also has peer limit |
| Empty DEMO | Existing public Status Page plus ID allowlist intersection |
| Unknown/unavailable metrics | Actual engine/API unavailable; UI deliberately clears stale healthy data |
| Socket reconnect fails | CDN WebSocket enabled, cookies forwarded and all dynamic paths bypass cache |
| Plan would create/replace | Wrong/missing state; stop and reconcile identity; do not apply |
| Image pull fails | Correct immutable digest/tag and registry read permissions |
| No notification delivery | Configure and test an authorized upstream provider; UI status is not delivery proof |

Keep private diagnostics local. Never post state, Basic headers, cookies, API tokens, backups or TOTP in GitHub issues. Use [SECURITY.md](../SECURITY.md) for sensitive reports.
