# Upstream tracking policy

Canonical upstream: https://github.com/louislam/uptime-kuma

This repository is **not a GitHub-native fork** (GitHub repo metadata says `fork=false`). It is an independent implementation currently containing no copied upstream application code. Imported files must preserve their original attribution and license notices.

A scheduled GitHub Actions workflow inspects the upstream default branch SHA. When it changes, it proposes a pull request updating `.github/upstream-state.json`. This is a **signal**, not a security fix.

Review checklist:

1. Inspect changed upstream commits, release notes and security advisories.
2. Categorize each change as applicable, not applicable (with reasoning), or pending investigation.
3. Port relevant fixes and add regression tests.
4. Require CI and human review before merging and deploying.
5. Record the upstream SHA considered and the changes implemented.

Never blindly merge upstream master into edge-specific architecture. Dependabot is configured for direct npm dependencies and GitHub Actions; enable Dependabot alerts/security updates in repository settings separately.
