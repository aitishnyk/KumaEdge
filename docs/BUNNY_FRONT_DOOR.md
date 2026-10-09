# KumaEdge Bunny production front door

The main Uptime Kuma v2 runtime listens on container port **3001**. **Do not expose its admin login over unencrypted HTTP.** The default Terraform roots currently provision a single-region Anycast TCP endpoint, not a finished TLS front door. A successful Terraform apply is therefore *not a green light for public login*.

## Supported operator choices

**Bunny-managed CDN endpoint:** Bunny Magic Containers supports a CDN edge endpoint. Its `bunny.run` URL is available after provisioning. Configure and verify a secure HTTPS public hostname, session-safe non-shared caching for **every dynamic HTML and API request**, and WebSocket transport. A CDN is **not** a safe default for private dashboard traffic without explicit cache policy verification.

**TLS-terminating reverse proxy within your managed deployment:** Another design is to use a separately managed TLS entry point and proxy to the container's port 3001. Before exposing it, validate certificate renewal, strict HTTPS redirect, WebSockets, forwarding headers, origin isolation and backup/restore procedures. KumaEdge does not silently provision a new reverse proxy, ACME certificates, or DNS changes.

## Acceptance gates

1. Verify the HTTPS certificate chain for the **actual** hostname from a different network; avoid certificate-bypass flags.
2. Before entering credentials, run `node scripts/check-production.mjs --url https://host.example --require-hsts` (only after TLS works).
3. Inspect private HTML and authenticated API requests in the browser developer tools. Ensure no shared CDN cache serves personalized pages, cookies, API endpoints or Engine.IO.
4. Test a real Engine.IO WebSocket upgrade, login/logout, 2FA, and session isolation between browsers.
5. Confirm Bunny exposes only intended services; do not enable any other public ports from the SQLite backup worker.
6. Verify the single writer, persistent volume, actual notifications and restore exercises as documented in [PRODUCTION_ACCEPTANCE.md](PRODUCTION_ACCEPTANCE.md).

The public audit is **read-only and unauthenticated**. It cannot prove correct caching of every authenticated response or safe storage of account secrets. Those must be validated on the live service; no Bunny account has been connected in this conversation.
