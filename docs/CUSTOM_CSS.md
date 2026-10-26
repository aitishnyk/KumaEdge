# Design & customization

KumaEdge's original Obsidian Cloud theme uses #080E17 background, #121C29 cards, #52D9B5 accents and #F0F6FC text. The styles and branding are MIT licensed; no external CSS framework or tracking script is loaded.

## Two separate interfaces

- `/demo`: gateway-owned [`demo.css`](../scripts/demo-assets/demo.css), [`demo.js`](../scripts/demo-assets/demo.js) and [`demo-mode.cjs`](../scripts/demo-mode.cjs) templates. Ship gateway changes through the verified local image workflow.
- `/status/<slug>`: original Uptime Kuma Status Page. Its Custom CSS is stored by upstream and does not change `/demo`.

## How to Apply the Obsidian Cloud Theme

1. Open your Uptime Kuma Status Page through the protected owner interface.
2. Enable **Edit**.
3. Find **Custom CSS**.
4. Paste [`examples/status-page/obsidian-cloud.css`](../examples/status-page/obsidian-cloud.css).
5. Select **Dark** theme.
6. Save.
7. Check desktop and mobile, including UP/DOWN visibility and attribution.

The example targets original Uptime Kuma 2.5.7. Its screenshot is generated in an isolated local dataset; the reference live `/status/kumaedge-demo` is not modified by this release. Custom CSS is presentation only; do not hide incident indicators or imply fabricated uptime.
