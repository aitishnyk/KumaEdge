# Enable a private or public DEMO

DEMO is an independent gateway application, not another Uptime Kuma engine. It reads only two fixed upstream public Status Page APIs. Both the configured ID/label allowlist and upstream public membership must allow a service. It never forwards visitor-supplied URLs, OWNER headers, tokens, raw monitor metadata or SQLite.

First create a deliberately public upstream Status Page. Configure the gateway through your private `TF_VAR_demo_environment` map; see [Configuration](CONFIGURATION.md). Keep credentials out of shell history. A private demo password must be 16–1024 bytes; use a password manager and the scrypt generator API in [`demo-mode.cjs`](../scripts/demo-mode.cjs). The maintainer's `configure-demo.py` is scoped to that existing deployment; use the environment map for new installs.

For an intentionally public showcase set `KUMAEDGE_DEMO_PUBLIC_CREDENTIALS=true`, username `demo`, and a random-salt scrypt verifier of the public password. This permits **only** demo/demo as the short identity. Store no password variable. Preserve an independent random session secret. The public UI explicitly displays the public credentials. Private deployments must omit the opt-in flag and never reuse demo/demo.

```bash
node -e 'process.stdout.write(require("./scripts/demo-mode.cjs").hashPassword("demo", undefined, {publicCredentials:true})+"\n")'
```

The output is a salted verifier, not an admin credential. Place it in your private deployment configuration as `KUMAEDGE_DEMO_PASSWORD_HASH`. Set the exact HTTPS origin, public slug and allowlist, then review your Terraform plan and approve any paid update locally. Rotating DEMO must preserve OWNER/admin/TOTP, volume, monitor configuration and allowlist. Rotate the session secret and restart the gateway to invalidate previous sessions. Verify old cookies fail, wrong credentials fail, demo/demo succeeds, administrative routes and Socket.IO remain unauthorized, and responses stay private/no-store.

Reference public demo: https://mc-b4n2u1709h.bunny.run/demo — `demo` / `demo`, read-only. This identity is intentionally public and grants no administrative privileges.
