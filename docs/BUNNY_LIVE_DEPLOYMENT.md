# Bunny live deployment

Status: **DEPLOYMENT_BLOCKED** pending registry and owner-confirmed paid plan.
No KumaEdge app existed in the complete `/mc/apps` listing on 2026-10-26;
DE was returned with capacity by `/mc/regions`. No existing app or volume changed.

The proposed configuration is one app, one replica, one region (DE), one 5 GB
volume at `/app/data`, original Kuma on private port 3001, and an owner gateway
using the same reviewed image on port 3002. Only the gateway has a CDN endpoint.
It requires an additional owner password even for first setup, strips that
credential before proxying to Kuma, forwards WebSocket, and returns private
no-store headers. Kuma's own authentication and 2FA remain necessary.

Terraform modules validate with pinned BunnyWay/bunnynet 0.19.1. That provider
hardcodes package `d2c1b95e-65e7-42a3-adb3-d27d9d1a4f72` and Shared runtime; it
does not expose CPU/RAM requests. Do not describe a configurable 1-core plan as
implemented. Current platform documentation describes CPU and RAM consumption
billing, with dynamic runtime limits, rather than a fixed small allocation.

[Current pricing](https://bunny.net/docs/magic-containers/pricing.md): CPU
$0.02/core-hour consumed, RAM $0.005/GB-hour in 64 MB blocks including overhead,
volume $0.10/GB/month allocated. CDN traffic is charged separately. A scenario of
730 hours at 0.1 CPU and 1 GB **total** RAM plus 5 GB volume is $5.61/month before
CDN traffic and taxes. Actual consumption can be higher; this is not a cost cap.
The CDN-only proposal does not request a paid Anycast IPv4 address.

After exact-image local verification and registry publication:

```sh
export KUMAEDGE_REVIEWED_SHA="$(git rev-parse HEAD)"
bash scripts/local/deploy-bunny.sh plan
# Inspect private full plan, source/image evidence and cost assumptions.
bash scripts/local/deploy-bunny.sh apply
```

Plan reads existing local Bunny profile and Docker credential helper into process
memory. Secrets never appear in command arguments. The generated owner password,
Terraform plan, logs and state remain private under `.local-release/FULL_SHA/`.
Apply displays the full saved plan and requires the human to type a confirmation
including the exact source prefix. The agent must not enter it. Plans with
resource deletions are rejected. Existing Kuma resources without matching state
require import/reconciliation instead of duplicate creation.

After apply, read `gateway_pullzone_id`, reconcile its zone with **caching
disabled and WebSocket enabled**, verify HTTPS and redirects, and test unauthorized
requests before entering any credentials. Use the Bunny-provided hostname; a
custom domain is unnecessary if its TLS certificate validates. The owner retrieves
the gateway password from the private local file; never post it in chat or a PR.
Only then perform Kuma setup, 2FA, monitoring and all live acceptance gates.

[Persistent-volume documentation](https://bunny.net/docs/magic-containers/persistent-volumes.md)
describes node-local volumes without automatic replication or backups. Scale-down
and rescheduling can produce a new empty volume. Keep min/max replicas at one;
never delete the old volume to force a reschedule. A real full-volume offsite
backup and isolated Bunny restore remain mandatory, separate from local DR.
No NFS is configured. Readiness and provider validation cannot prove live durability.
