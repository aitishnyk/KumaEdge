# Install your own KumaEdge

KumaEdge runs continuously on **paid** Bunny Magic Containers. It removes VPS administration, not compute billing. One region/replica with one SQLite writer is intentional. The standard module creates one app, two containers, one 5GB volume and a CDN endpoint/Pull Zone. Do not use the optional legacy third-container backup module for the reference architecture.

Run these Terminal command blocks in Bash (`bash` starts it from the default macOS shell).

## Prerequisites

Create an account using [Get Started with Bunny.net](https://bunny.net?ref=4mvi9kc9vn) (affiliate link; may support this project). Install Docker Desktop (Linux containers), Node.js 22+, Python 3, Terraform 1.5+ and age/age-keygen from their official vendors/package managers. Enable Docker Buildx. Use a trusted local Terminal and a fresh clone dedicated to **your own account**. Never copy the maintainer's private state or use the maintainer-specific `scripts/local/bunny-deploy.py`, `bootstrap-live.py`, `harden-existing-cdn.py` or live acceptance wrappers against another deployment.

```bash
git clone https://github.com/aitishnyk/KumaEdge.git
cd KumaEdge
node --version
python3 --version
docker info
terraform version
age --version
npm test
python3 -m unittest discover -s test/python -v
```

No npm dependencies are required on the host. The original engine dependencies are in the Docker image.

## Select an immutable release

Use the exact runtime/source SHA and `evidence.json` from a verified release, not a merge SHA, `latest`, or an unverified moving tag. Download evidence from the GitHub release. Authenticate Docker to GHCR using your normal credential helper and a least-privilege token with `read:packages` if required. Keep registry credentials off public CI.

```bash
read -r -p 'Verified full source SHA: ' TF_VAR_image_tag
read -r -p 'Absolute path to reviewed evidence.json: ' KUMAEDGE_RELEASE_EVIDENCE_FILE
export TF_VAR_image_tag KUMAEDGE_RELEASE_EVIDENCE_FILE
export TF_VAR_image_digest="$(node -p 'JSON.parse(require("fs").readFileSync(process.env.KUMAEDGE_RELEASE_EVIDENCE_FILE,"utf8")).images.main.digest')"
terraform -chdir=infra/bunny init -backend=false
terraform -chdir=infra/bunny validate
bash scripts/install-bunny.sh
```

The interactive installer privately requests your Bunny account key, GHCR pull token/username and a unique owner gateway password (32+ characters). Store the gateway password in your password manager before continuing. It verifies digest evidence against the registry before Terraform, prints the plan and charges warning, and requires typing `CREATE KUMAEDGE` before apply. **That step creates billable resources.** Cancel if any resource/account is unexpected. Keep `infra/bunny/terraform.tfstate` private, encrypted and backed up; it contains sensitive values. There is no built-in spending cap. Check current Bunny pricing in your account. Resource creation was not run as part of this documentation check.

## Secure the endpoint before setup

```bash
terraform -chdir=infra/bunny output app_id
terraform -chdir=infra/bunny output gateway_pullzone_id
terraform -chdir=infra/bunny output next_steps
```

Find the generated HTTPS hostname in your Bunny app. Before entering credentials, configure the associated CDN Pull Zone in Bunny's console: disable Smart Cache and error caching, forward cookies, enable WebSocket, force HTTPS, and add an **all-paths** edge rule with cache TTL 0 and response `Cache-Control: private, no-store, max-age=0`. Include API, HTML, Engine.IO polling and redirects. Never cache based only on static extensions or treat a valid certificate as proof that auth responses are private. The gateway also emits no-store; verify the actual edge behavior.

```bash
read -r -p 'Your HTTPS origin (no trailing slash): ' KUMAEDGE_PUBLIC_URL
export KUMAEDGE_PUBLIC_URL
node scripts/check-gateway.mjs --url "$KUMAEDGE_PUBLIC_URL"
curl --head "$KUMAEDGE_PUBLIC_URL/demo/login"
```

With demo disabled `/demo/login` returns 404; `/healthz` is public and other OWNER routes must challenge for Basic auth. The public checker confirms certificate validation, no shared caching and denial of unauthenticated owner/polling routes. Then verify authenticated Socket.IO polling/WebSocket through the protected upstream UI. The older `check-production.mjs` expects an exposed engine handshake and is not the protected-gateway installation check. Do not enter OWNER credentials over HTTP.

## Initialize ownership and monitoring

Open your HTTPS endpoint, pass the OWNER Basic gate as username `owner` with your gateway password, then create your **separate original Uptime Kuma administrator** in the protected setup UI. Enable TOTP in Uptime Kuma settings and keep recovery material in your password manager. These are two independent authentication layers.

Create HTTP/HTTPS/TCP monitors in the upstream UI, add an authorized notification integration, trigger a real controlled DOWN/UP, confirm delivery and persistence across restart. Create a deliberately public Status Page only for data you intend to expose. [Enable DEMO](DEMO_CONFIGURATION.md) separately; do not expose OWNER credentials.

Plan an encrypted [full-volume backup](FULL_VOLUME_BACKUP.md), a [restore drill](RESTORE.md) and [rollback](ROLLBACK.md). A newly provisioned app is not certified production-ready by a successful Terraform apply. The reference demo has no certified external notification channel.

The installer/preflight, shell syntax, Terraform schema and local real Docker workflow are tested without creating a second Bunny app. Account-specific billing, endpoint provisioning and delivery require your own reviewed live acceptance.
