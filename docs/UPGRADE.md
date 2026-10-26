# Upgrade

Keep exact source SHA, image digest, deployment state lineage and full encrypted data backup together. A merge SHA may differ from the runtime source SHA. Do not invent a tag for a merge commit. Never automatically pull latest.

1. Review source/upstream changes and permissions.
2. Run the [local release pipeline](DOCKER_DEVELOPMENT.md) on the exact clean source SHA.
3. Publish/verify the immutable OCI pair and retain publisher evidence.
4. Export the full existing volume with a cleanly stopped writer; verify isolated restore.
5. Generate an update-only plan using the existing private state. Confirm app, endpoint, volume, region and replica identities. No new resources or resets for reference updates.
6. Obtain local owner approval for the exact saved plan, then apply only reviewed image/config fields.
7. Verify running pod digest, HTTPS/private CDN cache/WebSocket, DEMO isolation and persisted monitor/Status Page/auth configuration. Check restart invalidates old gateway sessions.
8. Keep rollback image/state/backup; mark unverified external integrations honestly.

Reference operator entry point: `bash scripts/local/deploy-bunny.sh plan|apply` with `KUMAEDGE_REVIEWED_SHA` set. It is deliberately bound to the maintainer's app and private state, not a general new-install command. It never runs in Actions. See [rollback](ROLLBACK.md).
