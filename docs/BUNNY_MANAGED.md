# KumaEdge Bunny Managed Installation

Bunny Managed runs the **original Uptime Kuma v2** server, UI, scheduler, and notifications on paid Bunny Magic Containers. There is no self-managed VPS, but there is a persistent container and durable storage.

The image defaults to the upstream SQLite backend with `UPTIME_KUMA_DB_TYPE=sqlite`. For an existing MariaDB deployment, do not migrate or reuse this configuration without a separate migration plan.

For installation, follow [the Terraform guide](BUNNY_TERRAFORM.md) or run `bash scripts/install-bunny.sh` from a trusted interactive terminal. The installer requires your explicit approval before creating paid infrastructure; no production resources are created by CI.

The Terraform configuration uses a single replica, a persistent volume mounted at `/app/data`, and an **Anycast endpoint**, which does not automatically provide HTTPS. Set up a trusted TLS-terminating front door before creating any accounts or entering passwords; configure caching rules to prevent any shared caching of dynamic/admin responses.

## Live acceptance

After your public HTTPS hostname works, run:

```sh
node scripts/check-production.mjs --url https://monitor.example.com
```

The command audits HTML, Engine.IO polling **and WebSocket** transport, requiring safe visible cache policy on HTML and Engine.IO polling. See [production acceptance](PRODUCTION_ACCEPTANCE.md) for mandatory manual checks: login, 2FA, notification delivery, volume restart, full-volume backups/restores, and no-browser scheduler operation.

For upgrades, use the reviewed immutable image tagged with a successful main-branch SHA, and keep the `production` GitHub environment protected. Rollbacks require compatible database schema; restoring an older image alone may not reverse schema migrations.

References:
- https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app
- https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy
