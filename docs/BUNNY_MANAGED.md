# Deploy fully functional KumaEdge on Bunny Magic Containers

**Bunny Managed is the production-oriented track.** It runs the original Uptime Kuma v2 Node.js engine, UI, scheduler, notification integrations and SQLite. It requires no self-managed VPS, but a continuously running paid Bunny Magic Container. The separate Bunny Edge Script preview is stateless and not a production monitor.

## One-time installation

1. In GitHub Actions run **Bunny Managed - build and verify** with `workflow_dispatch`. Verify the real Docker smoke job and image publishing job both succeed.
2. In GHCR make the published `ghcr.io/aitishnyk/kumaedge:<40-character-Git-SHA>` accessible to Bunny (make package public or configure read-only package registry credentials in Bunny). The package may be private by default.
3. In the bunny.net dashboard open **Magic Containers → Add App → Single Region**. Choose one region for this SQLite-backed deployment.
4. Add a container **named `kumaedge`** pointing to that image, port **3001**, and configure **one replica only (minimum 1, maximum 1)**. **Attach a persistent volume at `/app/data`**. Never run it with ephemeral storage; otherwise all accounts and monitoring history will be lost at restart.
5. Add an **HTTPS edge endpoint** for port 3001. Disable caching of authenticated pages and dynamic API responses. Verify the chosen endpoint transports Socket.IO / WebSocket or long polling; if it doesn't, try the Bunny Anycast endpoint instead of CDN.
6. Visit the public URL, create a strong admin account during upstream setup, enable 2FA, add a monitor and a notification integration. Verify live heartbeats and one down/recovery alert.
7. Restart the Bunny container and confirm the admin account, monitor and history survive unchanged. Back up the volume before upgrades. Validate the monitor continues running with your browser closed.

## Updating without silently breaking data

Each commit to main that changes the managed image files runs a real Docker smoke suite, then pushes an immutable SHA-tagged image to GHCR. A daily upstream smoke run detects regressions, but deliberately does not auto-deploy a moving upstream `:2` image.

For the explicit deployment workflow configure GitHub `BUNNYNET_API_KEY` (Actions secret) and `BUNNY_MC_APP_ID` (Actions variable), and a protected `production` environment. Set the container name in Bunny to `kumaedge`. GitHub Actions → **Bunny Managed - manual production deploy** → supply the already published and tested SHA. For rollback redeploy the previous tested SHA. The workflow checks only the tag format; use the SHA from a successful publish job.

## Important limits

- Uptime Kuma's SQLite requires a stable, filesystem-compatible volume and **a single writer**. Avoid NFS and do **not** scale the same SQLite DB across regions/replicas. This is a single-region deployment.
- A magic container is managed compute, not zero-server execution; Bunny bills for it.
- The public repository is not a GitHub-native fork. The container image is derived from the official `louislam/uptime-kuma:2` image and retains its MIT license. Upstream security patches enter when a reviewed, tested image is rebuilt, not merely because an upstream SHA was observed.
- Bunny production acceptance (credentials, volume durability and WebSocket proxy operation) must be performed in your own account; code repository CI cannot prove live acceptance.

References: https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app and https://docs.bunny.net/docs/magic-containers-github-action
