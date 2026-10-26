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

## Final accepted release

The owner subsequently approved the image-only 5c2bd70 plan in the trusted local
terminal. Terraform apply completed successfully. Both actual running containers
use `ghcr.io/aitishnyk/kumaedge:5c2bd701758944b609dfd588ed12b3f97624c51b` at
`sha256:55b4f8a88396fa6b75163ee41c94c2cf0926e60a46cff8986913eb4ea3c99c48`.
The paired backup artifact digest is
`sha256:0b2c35cba40672523730217e39a701257ec9ef14ae7fdb561b0f4a044c881d22`.
Final source freeze had 89 Node and 51 Python tests without skips; both locally
built Linux/AMD64 images were published and independently pulled/verified.
Later documentation/operator-harness commits do not change runtime image source.

Final actual Bunny acceptance: OWNER/TOTP/logout/relogin, three real monitors,
controlled DOWN/UP, 105 seconds with operator clients closed and growing history,
DEMO login/data/isolation/CSRF/tamper/logout, HTTPS/polling/WebSocket/reconnect,
CDN private/no-store/no-shared-cache, full-volume encrypted backup and independent
local restore all PASS. Same existing volume AND volume instance, owner/TOTP and
history survive the final application restart. The formerly valid DEMO cookie is
rejected after restart; a new login succeeds. Public extra method/path/header/
SSRF/filesystem isolation matrix and real browser login/dashboard/logout PASS.
Final Terraform plan: no changes for the app and registry. New paid resources: 0.

The first a315114 restart needed a same-configuration deploy recovery and exceeded
the old 90-poll harness limit. The final 5c2bd70 acceptance completed with a larger
bounded wait and retained the private pre-restart cookie. The repository harness
now includes those already exercised operator-only changes.

Final readiness: **DEMO_READY**, not PRODUCTION_READY. External delivery receipts
are NOT_VERIFIED because the owner confirmed there is no notification channel.
Bunny-to-Bunny restore is NOT_RUN because additional paid resources are forbidden.
Mobile-browser layout and the full public one-hour TTL duration remain NOT_RUN;
local server-enforced TTL regression passes. No unexecuted test is counted PASS.

The paired backup OCI image is a release artifact, not a third cloud container.
No GitHub Actions were used. Repository Actions remain disabled.
