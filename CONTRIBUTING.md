# Contributing to KumaEdge

Thanks for contributing. This is a public MIT-licensed project with **DEMO_READY** reference validation.

1. Discuss substantial backend changes in an issue before implementation.
2. Keep credentials, Bunny API keys, access tokens, and monitor target secrets out of commits.
3. Prefer narrowly scoped pull requests with tests and reproducible steps.
4. Run `npm test` locally before opening a PR.
5. For security issues use private reporting per [SECURITY.md](SECURITY.md).
6. Preserve MIT license notices and include attribution for imported upstream code.
7. Do not label an implementation production-ready without deployment, persistence, scheduler, authentication and security tests.

The monitoring UI and engine belong to upstream Uptime Kuma. Contribute gateway, deployment, design and documentation changes here; discuss upstream behavior with the original project. Run the full local Docker release pipeline for runtime/authentication changes. GitHub Actions are disabled.
