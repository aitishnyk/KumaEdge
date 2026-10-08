# Deploy KumaEdge preview on Bunny (pre-alpha)

This preview demonstrates a **real Bunny Edge Script API** and static dashboard. It has no authentication, persistent history, uptime statistics, alerting, or periodic monitoring. Do not deploy it as a production monitoring service.

## API Edge Script

1. In the Bunny dashboard create a **Standalone Edge Script**, following Bunny's current Edge Scripting onboarding instructions.
2. Deploy `edge/script.ts` using your Bunny script deployment UI or the optional GitHub Action in `.github/workflows/deploy-edge.yml`.
3. Configure deployment secrets `BUNNY_SCRIPT_ID` and `BUNNY_DEPLOY_KEY` in GitHub Actions. These are **deployment credentials**, not the Bunny account API key.
4. Obtain the public HTTPS endpoint for the Edge Script and test `GET /health`, `GET /api/targets`, `GET /api/check?id=example`.

## Static dashboard

Upload the contents of `web/` to a Bunny Storage Zone / Pull Zone (or another static web host). Set `index.html` as the default document, and ensure HTTPS. Open the page and enter your script's public HTTPS base URL in the settings section.

The dashboard stores the chosen public API URL in browser localStorage. The script serves open read-only endpoints with a fixed allowlist of public target URLs and wildcard CORS. **Do not add private services, tokens or privileged endpoints** without implementing full authentication, SSRF prevention, per-target access control and rate limiting.

## Automated Edge Script deployment

The workflow only runs manually. It uses Bunny's documented `BunnyWay/actions/deploy-script` action and requires the exact script ID and deployment key. A live deploy is *not* possible until a Bunny account and script are provisioned.

## Limitations

- The sole sample target is `https://example.com/`, which can be edited in source before deployment.
- Results are live on-demand only; there is no scheduler or stored incident history.
- Edge Scripts are not a general raw TCP / ICMP / Docker monitoring replacement.
- Test runtime support and quota limits in your actual Bunny account.
- Hardcode only public low-risk targets for this preview; do not expose public arbitrary URL check endpoints.

Official reference: https://docs.bunny.net/docs/access-edge-database-with-turso
Official deploy action: https://docs.bunny.net/docs/edge-scripting-github-action
