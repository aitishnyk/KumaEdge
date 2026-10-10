# Mac local test runner for public KumaEdge

This is NOT a registered GitHub Actions self-hosted runner: GitHub advises against connecting a personal Mac as a runner to a public repository, because an untrusted PR can compromise the machine.

The script `scripts/run-mac-acceptance.sh` verifies the precise owner PR #34 HEAD SHA, checks out that immutable SHA into a private temporary folder and runs source regression, Python tests, shell syntax, encrypted age backup restore, both Terraform validations, primary/backup container builds and Docker persistence/isolated recovery tests when tools are present. It makes no Bunny API calls and cannot create paid resources.

A user running the one-line bootstrap from the assistant fetches the script from an explicit immutable SHA through `gh api` and invokes it using that same SHA. Inspect the script before running. Docker Desktop must be running for real Docker tests. Node >=20, Python 3, age/age-keygen and Terraform are expected for a full run. Missing dependencies are SKIP, not PASS.

Only test names and PASS/FAIL/SKIP status are posted automatically to public PR #34; local diagnostic logs are never uploaded. Production HTTPS, notification delivery, persistence on Bunny, GitHub-hosted runner scheduling and paid infrastructure require separate proof and are not checked here.
