# Configuration

The original Uptime Kuma engine is unchanged at 2.5.7. Gateway configuration lives in process environment; sensitive Terraform variables remain in private state. No credentials belong in Git, images, public issues or README except the intentional public demo identity.

| Variable | Scope / policy |
|---|---|
| `KUMAEDGE_FRONT_DOOR_PASSWORD` | OWNER Basic gate; unique >=32 characters |
| `KUMAEDGE_DEMO_ENABLED` | Exact `true` opts into separate DEMO; default disabled |
| `KUMAEDGE_DEMO_PUBLIC_CREDENTIALS` | Exact `true` permits only public username/password demo/demo |
| `KUMAEDGE_DEMO_USERNAME` | Private demo username; public mode must use demo |
| `KUMAEDGE_DEMO_PASSWORD_HASH` | Fixed-parameter salted scrypt verifier, never password env |
| `KUMAEDGE_DEMO_SESSION_SECRET` | Independent >=32-byte session signing secret |
| `KUMAEDGE_PUBLIC_ORIGIN` | Canonical HTTPS origin; CSRF checks require exact match |
| `KUMAEDGE_DEMO_STATUS_PAGE` | Existing intentionally public upstream slug |
| `KUMAEDGE_DEMO_SERVICES` | JSON ID/label allowlist intersected with public Status Page IDs |
| `KUMAEDGE_DEMO_SESSION_TTL` | Absolute 60–86400 seconds; default 3600 |
| `KUMAEDGE_OPS_TOKEN` | Separate high-entropy capability; keep private |
| `KUMAEDGE_BACKUP_RECIPIENT` | age public recipient; identity stays offline |

Public mode is deliberately public, not a security boundary. The verifier is checked at startup against the public identity; successful public logins avoid per-request scrypt work. A bounded global token bucket (100 burst, 20/s refill), body limits, CSRF, session capacity and absolute expiry remain. Private DEMO retains 16–1024-byte passwords, scrypt and peer throttling. Public mode never trusts forwarded IP headers, so a shared CDN peer does not get the private 10/minute limit. Capacity limits can still reject extreme load.

SQLite `/app/data` belongs only to the single engine writer. Never change the disposable-reset nonce/marker of an existing deployment. No runtime sends affiliate traffic automatically. Marketing destinations are centralized in [`demo-public.cjs`](../scripts/demo-public.cjs).
