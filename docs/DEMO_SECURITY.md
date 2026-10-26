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
One KDF operation runs at a time. Ten POST attempts per trusted socket peer per
minute are permitted; at most 1024 peers are retained. Forwarded IP headers cannot
reset this limit. Behind Bunny, a peer can be a shared CDN node, so the conservative
limit can affect multiple users. There is no per-user-IP claim or unbounded map.

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
