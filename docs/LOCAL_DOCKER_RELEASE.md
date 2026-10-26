# Local Docker release (v0.19 candidate)

GitHub Actions is archived. All release commands execute on a trusted Mac with
Docker Desktop, Buildx, Node 22+, Python 3, Terraform 1.5+, OpenSSL, age and gh.
No public or self-hosted runner is required.

Review the source, commit it, and run from a clean checkout:

```sh
nvm use 22 # or select an installed Node 22+ in PATH
export KUMAEDGE_REVIEWED_SHA="$(git rev-parse HEAD)"
bash scripts/local/release.sh
# Only after inspecting local evidence:
bash scripts/local/publish.sh
bash scripts/check-local-release.sh "$KUMAEDGE_REVIEWED_SHA"
```

`doctor` checks tools and Linux builder. `test` runs Node, Python (skips block
release), shell syntax and both Terraform modules. `build` loads Linux/AMD64
images with the exact source revision label. `verify` runs real monitoring,
session isolation, notifications to a controlled local receiver, restart,
TLS/STARTTLS, and encrypted full-volume recovery. All resources created by these
tests have disposable names; existing Bunny resources are never involved.

Evidence lives in ignored `.local-release/FULL_SHA/`, private by umask. It contains
source SHA, upstream reference, Docker/Buildx versions, tested image config IDs,
checksummed acceptance logs and timestamps. This is an unsigned local operator
record, not signed provenance or proof of independent code review. The exact SHA
must be explicitly selected by the operator; untracked/modified files block release.

Publishing can reuse an existing macOS Docker credential helper with `publish.sh --keychain`,
without exposing the stored token. Otherwise it asks for a registry username and hidden package token in a terminal.
It uses a temporary Docker configuration, refuses existing/ambiguous SHA tags,
pushes the already tested images without rebuilding, pulls them back and compares
config IDs. `evidence.json` records actual remote root manifest digests for both
images. A partial push must be reconciled manually; never overwrite either tag.
The registry guard does not provide a cross-publisher atomic lock: use one operator.

Do not upload raw logs, Terraform state, fixture credentials or private API results.
Use `check-legacy-actions-release.sh` only for historical Actions-built releases.
See the acceptance report for actual coverage and remaining gates; script presence
does not certify a release.

The public gateway is separately regression-tested with real HTTP authentication,
credential stripping, no-store and a real WebSocket upgrade. Docker runtime tests
also exercise it against the original Kuma server. It adds no monitoring engine or
database writer. The original engine's port remains 3001; deployment exposes only
the gateway on 3002 through Bunny CDN. Local fixtures listen only on loopback.
