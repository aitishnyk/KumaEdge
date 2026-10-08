# KumaEdge

**Run Uptime Kuma on Bunny.net without managing your own VPS.**

Open-source MIT project with two deployment modes:

| Mode | Status | Runtime |
| --- | --- | --- |
| **Bunny Managed** | Full upstream Uptime Kuma image, deployment scripts and Docker smoke suite; live Bunny verification required | Bunny Magic Containers, persistent /app/data volume |
| **Bunny Edge Preview** | Limited to manual checks on configured endpoints | Standalone Edge Script; no scheduler, DB, incidents or alerts |

### Start with the full product

**[Bunny Managed setup guide](docs/BUNNY_MANAGED.md)** — one region, one replica, persistent volume at `/app/data`, image `ghcr.io/aitishnyk/kumaedge:<SHA>` from the successful GitHub Actions build. Once configured, Uptime Kuma provides the full web interface, 24/7 monitoring, notifications, status pages and history without a VPS.

- Build/test/publish: `.github/workflows/bunny-managed-image.yml`
- Deploy reviewed image: `.github/workflows/deploy-managed.yml`
- On-demand serverless preview: [Bunny Edge guide](docs/BUNNY_DEPLOY.md)

**KumaEdge is an independent repository, not an official GitHub fork or an affiliate of Uptime Kuma or Bunny.net.** The managed image uses the official [Uptime Kuma](https://github.com/louislam/uptime-kuma), which is MIT-licensed, and preserves its original application and copyright notices. Edge-specific code is developed separately. Security updates are tracked, reviewed and incorporated via tested upstream images; no promise of unattended patching or zero downtime.

[Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [Roadmap](docs/ROADMAP.md) · [MIT License](LICENSE)
