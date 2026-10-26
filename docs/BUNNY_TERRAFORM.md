# Bunny Terraform

See [Installation](INSTALLATION.md) for the current new-install path. Standard module: [`infra/bunny`](../infra/bunny/main.tf), official BunnyWay/bunnynet provider pinned in the lockfile. It creates **two containers** (`kumaedge` internal 3001 and `owner-gateway` public 3002), one DE replica by default, one persistent volume and one CDN endpoint/Pull Zone. TLS/cache/WebSocket require live acceptance. The engine has no public endpoint.

`terraform init`, `terraform fmt -check`, `terraform validate` and a reviewed saved plan run locally. All applies require a human; no GitHub Actions. Never apply a clean new-install state against an existing app. Existing apps require their own securely retained/imported state, confirmed app/volume/endpoint identities and an update-only plan. State contains credentials; do not publish it or its plan JSON. Preserve lineage, backups and rollback images.

Reference deployment update tooling deliberately pins the maintainer app ID; it is not a generic installer. New users use `bash scripts/install-bunny.sh` in a fresh clone and their own account. The legacy `--with-backup` variant adds a third container and external storage; it is outside the two-container reference architecture and is not needed for full-volume exports.

API, registry and technical provider URLs remain direct official destinations:
- https://registry.terraform.io/providers/BunnyWay/bunnynet/latest/docs/resources/compute_container_app
- https://registry.terraform.io/providers/BunnyWay/bunnynet/latest/docs/resources/compute_container_imageregistry
- https://docs.bunny.net/docs/magic-containers-how-to-deploy-your-app

[Deploy on Bunny.net](https://bunny.net?ref=4mvi9kc9vn) is an affiliate link that may support this project. Billing is usage-based; review current prices and your plan. No fixed spending cap is implemented.
