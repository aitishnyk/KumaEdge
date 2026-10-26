# Integrated Demo Mode — KumaEdge 0.20.0

Demo is optional and disabled by default. It runs in the existing owner-gateway
process on port 3002, alongside the original Kuma engine on port 3001. No new cloud
container, database, volume, Pull Zone, app, or hostname is required.

`/` remains the owner Basic-auth gateway followed by the independent Kuma admin
login and TOTP. `/demo` has an independent HTML login, opaque cookie session and
read-only dashboard. A demo credential never becomes an upstream credential.

The dashboard displays explicitly public labels, actual heartbeat state, response
time, 24-hour uptime, recent response history, recorded DOWN/recovery transitions,
last check and successful engine contact. It supports light/dark preferences and
mobile widths. Empty and unavailable states do not fabricate measurements.
Certificate details and free-form incident content are intentionally not exposed.

Routes: `/demo`, `/demo/login`, `/demo/logout`, `/demo/assets/demo.css`,
`/demo/assets/demo.js`, `/demo/api/status`. There is no general API proxy, Socket.IO
endpoint, monitor editor, shell, file browser or interactive sandbox under demo.

See [configuration](DEMO_CONFIGURATION.md), [security](DEMO_SECURITY.md), and the
[live acceptance record](BUNNY_LIVE_ACCEPTANCE_REPORT.md). Source implementation or
local test success does not establish that this version is deployed publicly.
