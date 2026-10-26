# Demo security boundary

The gateway dispatches demo paths before owner proxying. Demo HTTP input is never
forwarded to Kuma. Demo upgrade attempts are denied even with owner Basic auth.
Owner proxy requests strip Basic credentials, demo cookies, Forwarded, X-Real-IP
and all X-Forwarded-* fields; client-supplied proxy claims are not trusted.
Malformed paths, encoded separators/dot segments and double-encoded paths are
rejected before dispatch. Asset paths are an exact two-file allowlist.

Sessions use 256-bit random IDs, HMAC-SHA256 integrity, a separate key, server-side
absolute expiry and a bounded 1000-entry in-memory store. The cookie is Secure,
HttpOnly, SameSite=Strict, host-only, Path=/ with the __Host- prefix. Restart fails
closed. Login always creates a fresh session and invalidates any old presented
session. Logout requires POST, an authenticated session, matching Origin and a
per-session CSRF token; it removes the session and expires the cookie.

Login requires a signed expiring double-submit token and an exact configured
Origin. KDF work uses asynchronous scrypt with fixed N=16384, r=8, p=1, a random
128-bit salt and 256-bit result; parameter injection is rejected. Comparisons are
constant-time over fixed-size digests. Passwords and request bodies have limits.
Private mode runs one KDF at a time and permits ten POST attempts per trusted peer per minute (at most 1024 peers). Public opt-in mode validates the fixed demo/demo verifier once at startup and compares the known public password in constant time without per-request KDF work. It uses a bounded global token bucket (100 burst, 20/s refill), avoiding private-mode lockout of ordinary users behind a shared CDN IP. Forwarded IP headers are never trusted. Both modes retain body limits, CSRF and the 1000-session capacity. Public credentials do not protect confidentiality; the strict read-only allowlist is the boundary.

The adapter can fetch only two fixed local public-status API routes using a
validated deployment-time slug. It has a timeout, redirect prohibition, 2 MB body
limit, bounded public service/history output and no user-controlled destination.
It does not open SQLite or mount /app/data in the gateway. It intersects public
monitor membership with explicit IDs, uses configured public labels, and copies
only numeric status/ping/uptime and syntactically valid timestamps. No private
URL, name, notification, header, message, admin identity, API key, connection data,
free-form incident text or upstream object is returned. Internal public-data cache
lasts 10 seconds; upstream Kuma status APIs also cache public data. Revoke demo
access/rotate the secret immediately when removing previously shared information;
public status pages are public by design and cannot retract historical disclosure.

All demo responses, including errors and assets, use private/no-store. CSP permits
only local scripts/styles/connect, forbids embedding/base URLs and inline script;
titles are HTML-escaped and fetched data is rendered with textContent. Errors are
generic. Security claims require local adversarial tests plus public tests after
actual deployment; local fixture tests never substitute for live session checks.

Bunny policy for the existing zone disables caching globally with TTL zero, retains
cookies and WebSockets, forces HTTPS and overwrites Cache-Control with private,
no-store. HSTS is only max-age=86400, enabled after validating actual TLS; there is
no includeSubDomains/preload. Review private snapshots before any policy rollback.

## Optional encrypted owner operations

The existing engine container can run a supervisor that launches the unchanged
Kuma server and a loopback-only operations listener on 3003. Only the original
engine writes SQLite. The gateway has exact POST-only `/__kumaedge/backup` and
controlled acceptance target routes; both owner Basic and a separate high-entropy
operations token are required. Demo credentials/cookies never grant either.
The token is stripped from normal owner proxy requests. Request bodies/transfer
encoding are refused on operator routes. There is no file path, recipient,
command or destination parameter supplied by HTTP input.

The backup recipient is fixed in private deployment configuration; the decryption
identity remains exclusively in local Keychain. Backup cleanly stops the writer,
streams the complete data tree through the existing SHA-256-manifest age tool,
restarts the same engine and returns only encrypted bytes with an integrity hash.
One backup may run at a time; temporary encrypted files are removed after transfer.
No plaintext archive or decryption key is created in Bunny. This operation briefly
interrupts Kuma sessions; accepted reconnect/relogin tests are mandatory.

A one-time disposable reset is opt-in, scoped to this exact app and local owner
authorization. It removes only children of /app/data, never the mount itself.
A persisted completion nonce prevents repeat resets on restart or later image
updates. The old-data waiver is consumed by the approved initial update; it cannot
silently waive backups for future data. No public HTTP reset endpoint exists.
