# v0.20.1 — Obsidian Cloud demo

The independent `/demo` and `/demo/login` use an Obsidian Cloud design: #080E17
background, #121C29 cards and #52D9B5 accents. No external font, tracking pixel,
analytics SDK or new runtime dependency is loaded. Existing demo credentials,
signed server-side sessions, CSRF, rate limits, allowlist and OWNER authentication
remain unchanged. Original Uptime Kuma 2.5.7, SQLite and `/status/kumaedge-demo`
are preserved. No new Bunny resource or public engine endpoint is required.

## Public links

`scripts/demo-public.cjs` is the canonical public-link configuration. Its only
Bunny homepage destination is `https://bunny.net?ref=4mvi9kc9vn`. The server renders
navigation, login, dashboard CTA and footer from this constant. External links
open with `rel="noopener noreferrer sponsored"`. Affiliate disclosure and an
explicit independent-project notice appear on both pages. No automatic affiliate
navigation occurs. GitHub/upstream links point to their actual repositories.

The README showcase is generated from the same configuration:

```sh
node scripts/sync-demo-readme.cjs
node scripts/sync-demo-readme.cjs --check
```

Only marketing/homepage links use the affiliate URL. API, registry, SDK, Terraform,
pricing and official technical-documentation destinations are untouched. Tests
check the two rendered pages, generated README and public Markdown/HTML links.
The screenshot is real recorded data in a disposable local Kuma restored from a
verified Bunny-source backup; it is not a fabricated uptime or production SLA.

## Metrics and frontend states

All service data comes from the existing allowlisted public status-page adapter.
Overview figures are the count of currently UP shared services, arithmetic mean
of available latest response measurements, and arithmetic mean of reported 24h
service uptimes. These are explicitly labeled, not a weighted global SLA.

The response chart uses actual recorded samples. Missing values are gaps, not
interpolated successful checks. Each uptime/history bar corresponds to a recorded
heartbeat; no synthetic padding is added. Recorded events are sorted by timestamp.
An unavailable backend clears metrics/cards instead of retaining a healthy state.
Manual refresh uses the same fixed read-only endpoint and does not change monitors.

Local browser verification covers the default desktop viewport and responsive
320/390/768 px browser viewports, no horizontal overflow, >=44px mobile buttons,
16px login inputs, a real controlled monitor DOWN/recovery, real backend timeout,
error/recovery presentation and consistency of overview values with service cards.
Viewport overrides are reset afterwards. No affiliate click traffic is generated.

## Safe existing-app update

Use the existing local Mac Docker pipeline, paired immutable SHA images and
persistent deployment state. GitHub Actions remain disabled. Before approval,
create and verify a full actual Bunny age backup, preserve the old release digest,
form an image-only plan and review the exact existing-resource identities. Never
reset data, rotate credentials, change the reset nonce, or alter endpoint/volume.

`premium-live-acceptance.py before` privately captures a configuration fingerprint
from the verified full backup and an existing DEMO session. After the human's exact
local approval, run `premium-live-acceptance.py` with the reviewed runtime SHA.
It verifies actual pod digests, performs OWNER gateway/socket isolation and DEMO/
affiliate/HTTPS/WS/OWNER-isolation tests and stale-session rejection, exports and
independently restores the new full volume, then checks that owner password/TOTP, monitor and original
Status Page/group configuration hashes are unchanged. Authentication fingerprints
remain private; no factor is printed, overwritten or re-enrolled. A successful
interactive admin TOTP login is not claimed when the owner has a different current
factor from the local Keychain record. It never calls setup,
add-monitor, saveStatusPage or any production mutation bootstrap routine.

Rollback retains the previous immutable main and paired backup references from
v0.20.0 (runtime SHA `5c2bd701758944b609dfd588ed12b3f97624c51b`) and verified encrypted
full-volume backup. Roll back only with a new reviewed existing-app image plan and
local owner approval; do not replace/detach/delete the live volume. This release
has no upstream engine/schema change. Preserve the stable one-shot reset marker.

Deployment status and actual release SHA/digests are recorded in the execution
report and PR after publication/application. Preview screenshots and local tests
are not a claim that the new image is already live.
