# Local Docker development

Prerequisites: Node.js 22+, Python 3, Docker Desktop / Buildx, Terraform and age. Run from the repository root. No GitHub Actions.

```bash
npm test
python3 -m unittest discover -s test/python -v
export KUMAEDGE_REVIEWED_SHA="$(git rev-parse HEAD)"
bash scripts/local/doctor.sh
bash scripts/local/test.sh
bash scripts/local/build.sh
bash scripts/local/verify.sh
```

The release scripts require a clean tree and the exact reviewed HEAD. Build targets linux/amd64 for Bunny. Evidence is private under `.local-release/<SHA>/`. Verify exercises real disposable Docker runtimes: owner/TOTP, TLS/STARTTLS, monitoring/DOWN-UP, full backup/restore, persistence and migration. Local named volumes are temporary; production data is never mounted into tests. These tests do not certify external notification delivery.

To publish the verified immutable pair with your existing credential helper:

```bash
bash scripts/local/publish.sh --keychain
```

The publisher checks exact source, both images, evidence and current remote digests. Never reuse a published SHA tag for different bytes. Update the publisher namespace deliberately for forks. Do not place tokens in command arguments. [Upgrade](UPGRADE.md) describes deployment gates.
