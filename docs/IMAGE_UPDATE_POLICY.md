# KumaEdge — reviewed upstream security image updates

The managed Dockerfile pins the official Uptime Kuma v2 image to a reviewed registry SHA-256 digest, not only the moving `:2` tag. The optional backup-worker Python base image is pinned too.

The [upstream image watcher](../.github/workflows/upstream-image-watch.yml) checks the current Docker Hub `louislam/uptime-kuma:2` digest daily, opens a branch with just the changed Dockerfile digest and attempts a review PR. If the repository denies PRs created by Actions, it posts a deduplicated Issue. **It never automatically merges or deploys upstream changes.**

Before merging a digest update, review upstream security fixes, breaking changes, database-migration requirements, and the Docker container tests including the full-volume `age` recovery rehearsal. Production deployment is separately approved through a protected GitHub Actions workflow; it is not automatically updated.

Nightly and manually triggered managed Docker builds continue to run tests, but cannot publish GHCR tags. Only a reviewed push to `main` attempts publication. A guard checks both SHA-tagged images before pushing: both present means skip, exactly one present means fail closed, neither present means publish. It is a **workflow-level safeguard**, not a registry-enforced immutable tag policy against package administrators.

**Known limit:** the backup-worker Dockerfile still resolves Debian `age` packages at build time. Thus pinning its base digest does not guarantee byte-identical whole-image rebuilds across time. No such claim is made. GHCR-image production rollback should reference a known tested image and compatible SQLite schema.

Technical reference: [Docker Buildx registry inspection](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/).
