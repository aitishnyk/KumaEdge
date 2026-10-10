# KumaEdge — reviewed upstream security image updates

The managed Dockerfile pins the official Uptime Kuma v2 image to a reviewed registry SHA-256 digest, not only the moving `:2` tag. The optional backup-worker Python base image is pinned too.

The [upstream image watcher](../.github/workflows/upstream-image-watch.yml) checks the current Docker Hub `louislam/uptime-kuma:2` digest daily, opens a branch with just the changed Dockerfile digest and attempts a review PR. If the repository denies PRs created by Actions, it posts a deduplicated Issue. **It never automatically merges or deploys upstream changes.**

Before merging a digest update, review upstream security fixes, breaking changes, database-migration requirements, and the Docker container tests including the full-volume `age` recovery rehearsal. Production deployment is separately approved through a protected GitHub Actions workflow; it is not automatically updated.

Nightly and manually triggered managed Docker builds continue to run tests, but cannot publish GHCR tags. Only a reviewed push to `main` attempts publication. A guard checks both SHA-tagged images before pushing: both present means skip, exactly one present means fail closed, neither present means publish. It is a **workflow-level safeguard**, not a registry-enforced immutable tag policy against package administrators.

**Known limit:** the backup-worker Dockerfile still resolves Debian `age` packages at build time. Thus pinning its base digest does not guarantee byte-identical whole-image rebuilds across time. No such claim is made. GHCR-image production rollback should reference a known tested image and compatible SQLite schema.

Technical reference: [Docker Buildx registry inspection](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/).

## v0.14 — Strict release eligibility and GHCR failure handling

The manual production workflow now checks three independent gates **before** calling Bunny: the SHA belongs to `main`, a completed successful **push** execution of `.github/workflows/bunny-managed-image.yml` published that exact SHA, and the GHCR images are retrievable. It refuses missing Bunny credentials, an unsupported backup mode and dispatches from branches other than `main`.

The publisher distinguishes an **explicit missing registry manifest** from a registry authentication, timeout, rate-limit or network error. Ambiguous errors **fail closed** instead of treating an inaccessible manifest as safe to overwrite. If exactly one of two image tags exists, publication stops; the operator must reconcile it. Publication is serialised by Git commit SHA to avoid duplicate writers.

The script checks official GitHub Actions release history with the GitHub workflow token and requires `actions: read`. It does not contact Bunny or expose any registry/login credentials.

**Threat-model boundary:** A successful workflow and a tag in GHCR do not cryptographically prove the registry bytes never changed. Repository/package administrators can still mutate tags outside this workflow. A future step could use signed SLSA provenance, OCI digests passed through the deployment API and GitHub artifact attestations, subject to Bunny deployment support. Until then, compare registry digests against recorded release evidence for high-risk rollbacks.

## v0.15 — GHCR digest admission evidence (not a signature)

On the **initial successful publish of both SHA tags**, the main push workflow queries GHCR for the OCI manifest digest of each image, then uploads one GitHub Actions artifact `kumaedge-oci-digests-<commit-sha>`. The artifact is created only when both images were actually pushed by that run, never when the workflow skipped existing tags. This prevents a later green but non-publishing run from becoming new provenance for potentially retargeted tags.

Before any Bunny update, production deployment requires a successful main push publisher whose artifact is present, unexpired, nonempty, and downloadable. It then compares both currently resolved GHCR manifest digests to those recorded in the publishing run; a missing artifact, expired evidence, registry error, incomplete pair, or changed digest fails closed. Artifacts expire after 90 days: old releases must not silently bypass these gates. Releases predating v0.15 lack digest evidence and cannot use the v0.15 admission workflow without a new reviewed publication process.

**Security boundary:** This protects against GHCR SHA-tag retargeting **between publication and deployment check**, but does not cryptographically sign the image, make GHCR tags immutable, or prove that Bunny's tag-based update API will pull the same bytes after the check (TOCTOU). That last risk requires deployment by digest or a vendor-supported immutable image reference. A GHCR pair published successfully but missing its artifact (for example, an artifact upload failure) must be reconciled manually; never regenerate publisher evidence from arbitrary existing tags.

## Docker Hub 429 mitigation for pinned upstream bases

The Bunny Managed build uses immutable Docker Hub base-image digests. Anonymous pulls from a shared GitHub Actions runner can hit Docker Hub's HTTP 429 unauthenticated rate limit before any application tests execute. Configure GitHub Actions repository secrets `DOCKERHUB_USERNAME` (Docker Hub username) and `DOCKERHUB_TOKEN` (read-only Docker Hub access token) to enable `docker login --password-stdin` **before** building either image. This does **not** change the pinned digests or disable `docker build --pull`. Configure both secrets together; a half-configured credential set fails before building.

Without both secrets CI attempts anonymous pulls and may still be rate-limited; that is an infrastructure blocker, not a product regression, and it must not be bypassed by unpinned base images. Secrets must be configured in the repository's private Actions settings and never included in PRs, logs, or public Issues.
