# Upstream audit — 2026-10-26

Source baseline: KumaEdge `8bf72615a138eb4df52bb78239b4406512e0b773`.
The previous pinned image was executed and identifies itself as **2.5.6**;
2.5.4–2.5.6 fixes are already included in that baseline. The incremental
engine update is 2.5.6 → 2.5.7.
Latest stable official release queried through GitHub API: **2.5.7**, published
2026-10-23; commit `d54e4619e52553416e292549f435cc7e57330c29`.

Official Docker Hub OCI index verified using Buildx:
`sha256:4b95dbe7ac5343b768f8e04e3035ccd59997872b1a35ab9b0f082d2cc279070e`.
Linux/AMD64 manifest:
`sha256:2e1a606449aab9b7577620ec87554c71e924d8f3dedd50e69b938c63c8d5d1b9`.
The Dockerfile pins the version plus index digest; builds explicitly target AMD64.

Reviewed release notes: 2.5.4 adds SFTP and notification providers, fixes jsonata
CVE-2026-77415 and badge resource exhaustion GHSA-wf2j-5mc7-5c4w; 2.5.5 fixes TCP
monitor memory leak; 2.5.6 fixes average-response badge and dependencies; 2.5.7
fixes SSL/STARTTLS retries and updates Docker Node to 22.23.4 (revoked CA fix).
Public security advisories were fetched from the official repository.

[Issue #8019](https://github.com/louislam/uptime-kuma/issues/8019) remains open:
self-signed TCP SSL certificates accepted previously can fail after 2.5.7.
The upstream `checkTlsCertificate` uses certificate verification with the Node
trust store. No global verification bypass is acceptable. The local regression
harness checks rejection of an untrusted certificate and verifies a narrowly
supplied test CA via `NODE_EXTRA_CA_CERTS`, including STARTTLS. This documents a
trust configuration requirement, not a claim that upstream fixed #8019. Existing
self-signed monitors must be audited before upgrade; use an explicitly trusted CA.

`bash scripts/local/update-upstream.sh` fetches latest stable notes, manifests,
advisories and open version-related bugs, compares the current pin and prints a
proposed replacement. An operator reviews and edits the pin, commits, then runs
the complete local pipeline. No watcher publishes or deploys automatically.

Sources: [official releases](https://github.com/louislam/uptime-kuma/releases),
[security advisories](https://github.com/louislam/uptime-kuma/security/advisories),
[official image](https://hub.docker.com/r/louislam/uptime-kuma/tags).
