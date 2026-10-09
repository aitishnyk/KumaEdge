# KumaEdge production acceptance checklist

The **Bunny Managed** runtime is the original Uptime Kuma v2 in a Magic Container. A successful Docker build and Terraform validation do not establish that a deployed public endpoint is safe.

## Transport (automated, read-only)

After configuring a **trusted HTTPS** hostname and a single-replica instance, run:

```sh
node scripts/check-production.mjs --url https://monitor.example.com
```

This command makes only unauthenticated requests, does not store or send admin credentials, and fails if:
- HTTPS is missing or a URL contains embedded secrets/subpaths.
- HTML is not a successful HTTP 200 response.
- HTML or Engine.IO polling responses lack explicitly private/no-store cache policy, advertise cache hits, or include shared cache directives.
- The Engine.IO polling handshake is malformed/oversized or a **real WebSocket opening packet** cannot be obtained.

The test does not prove the absence of caching across all routes or authenticated variants, correctness of your CDN rules, or any other production security property.

## State and monitoring (manual, mandatory)

1. Confirm a *single* writer and durable volume mounted at `/app/data`; do not use NFS-backed SQLite.
2. Register admin over HTTPS only, set a strong password, enable 2FA.
3. Create an HTTP monitor for an endpoint you control and a Telegram/other notification channel; induce a controlled outage and verify exactly one down alert and one recovery alert.
4. Close all browser sessions, wait for another check and verify its timestamp advanced.
5. Restart the Bunny app (without detaching/deleting the volume). Confirm login, monitors, prior heartbeats and incidents survive.
6. Back up **the entire** `/app/data` directory using a trusted volume-access mechanism and restore it **in a separate isolated test instance**. The SQLite-only snapshot utility is partial.
7. Record the published immutable GHCR image SHA, Bunny App ID, endpoint hostname and **non-secret** acceptance evidence privately.
8. Keep production deployment behind an explicitly approved GitHub Actions environment. Validate successful smoke again after each upstream patch/upgrade.

Do not treat a successful unauthenticated audit as permission to enable public signups or serve authenticated content through a shared cache.

## Front door transport-hardening (v0.10)

The default Terraform configuration uses **Anycast TCP** for port 3001. This **does not establish trusted HTTPS**, and admin credentials must not be entered into plain HTTP. Bunny Magic Containers also supports CDN endpoints, which can provide a managed `bunny.run` hostname, but dynamic authenticated Uptime Kuma content must never be served from a shared cache. Verify login/cookie/cache behavior and WebSocket upgrades with a real account before public launch. See [Bunny official endpoint instructions](https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app).

Once a trusted HTTPS front door and session-safe cache rules are configured, run:

```sh
node scripts/check-production.mjs --url https://YOUR_TRUSTED_HOST --require-hsts
```

The optional `--require-hsts` check fails unless the HTML response contains a `Strict-Transport-Security` directive with at least one year of `max-age`. HSTS is an optional deployment gate, not silently inserted by the app; configure it **only after HTTPS works correctly** for the host. Avoid indiscriminate `includeSubDomains` and `preload`, especially for hostnames you do not control. In GitHub Actions, set `KUMAEDGE_REQUIRE_HSTS=true` to enable this additional check in the read-only acceptance workflow. HSTS on one response does not prove complete transport/session security, and a successful audit still requires operator verification of authenticated sessions, 2FA and data durability.
