# Security policy

## Supported versions

KumaEdge is currently pre-alpha. There is **no production-supported release** or security patch SLA.

## Reporting a vulnerability

Please **do not open a public GitHub issue** containing exploitable details. Use GitHub's private vulnerability reporting if enabled, or contact the repository maintainers through a private channel listed in the GitHub organization profile.

Include affected commit/version, reproduction steps, impact, and any suggested remediation. Never include real credentials or personal data.

## Upstream handling

We track Uptime Kuma security updates but the original Node.js/SQLite architecture and the planned edge backend are different. Not every upstream change applies. Each relevant fix requires a documented applicability decision and CI checks before release.

No dependency update or upstream merge should deploy automatically without required gates.
