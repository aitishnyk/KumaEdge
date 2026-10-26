# KumaEdge v0.20.0 live acceptance

The owner approved source `a31511486cdcf9d6f59f70fa7b00ccfc2d5a89dc` in the trusted
local terminal. Bunny accepted the existing-app update and both running containers
use main digest `sha256:658c794a909a955a2cbb9adafe4c22a22ce7bf48b2277bb70692967e21d25e19`.
The provider returned an inconsistent-result error because its API sorts environment
variables alphabetically. A private state backup and refresh-only reconciliation
preserved state lineage; with the corrected sorted configuration both resources
plan no-op. No second cloud update was performed to recover state.

Existing app `E2quWe26NmOfL7q`, Pull Zone `6868097`, two containers, one DE replica,
5GB volume `117a1d40-18e4-4041-b8f7-57e2603cd32a`, volume instance
`db5c6016-d098-4851-9253-cb2eb581357c` and HTTPS hostname remain unchanged.
New paid resources: **0**. State and infrastructure credentials stay private.

The owner explicitly waived retention of the old disposable test data and authorized
one contents reset. The old-data gate is `OWNER_WAIVED_DISPOSABLE_DATA`, never PASS.
The single-use authorization is consumed. The fixed reset nonce and completion
marker must be preserved; do not rotate the nonce or delete the marker. New owner
credentials/TOTP were enrolled through genuine Kuma APIs and stored in local macOS
Keychain. The existing gateway credential was preserved.

## Observed live results

- OWNER gateway, original Kuma admin, real TOTP, invalid-factor rejection,
  logout/relogin: PASS.
- Real HTTPS/TCP monitors against the owned hostname and controlled local DOWN/UP,
  with persisted history: PASS. Heartbeat counts grew with operator clients closed.
- Public independent DEMO login/data, allowlist, owner/API/WebSocket denial,
  tamper/CSRF rejection, logout and owner transport reconnect: PASS.
- Browser DEMO login initially exposed a Referrer-Policy bug: `no-referrer` makes
  HTML form navigation send `Origin: null`, correctly rejected by CSRF checks.
  The existing CDN rule now sets `same-origin`, preserving strict origin checking;
  actual browser login and real dashboard then passed. Gateway source is corrected
  to the same policy. See the [Fetch algorithm](https://fetch.spec.whatwg.org/#append-a-request-origin-header).
- Private/no-store, no Age/HIT, CDN BYPASS for tested GETs: PASS. Bunny omits the
  CDN-Cache diagnostic on POST 303; the harness accepts only absence/BYPASS there,
  still requires no-store and no Age, and retains strict BYPASS for GET responses.
- Actual Bunny clean-writer full-volume age export: PASS. SHA-256 verified.
  Independent local restore, network=none, real compatible Kuma boot, SQLite
  integrity and original private configuration/history/assets: PASS.
- Live directories carry setgid modes. Archive verification now compares the full
  declared permission metadata, while restore deliberately strips privilege bits.
  File content digests were correct; the previous failure was a verifier mode
  mismatch. Regression tests cover special modes and permission tampering.

Same-volume application restart and post-restart session/data checks are still
pending at this source freeze. External delivery receipts are NOT_VERIFIED because
no authorized notification destination is configured. Bunny-to-Bunny restore is
NOT_RUN: another paid app/volume is forbidden. Mobile-browser layout and the full
public one-hour session-expiry duration are NOT_RUN; local TTL enforcement passes.
Use the final execution report for the final candidate SHA, OCI digests and gates.

The paired backup OCI image is a release artifact, not a third cloud container.
No GitHub Actions were used. Repository Actions remain disabled.
