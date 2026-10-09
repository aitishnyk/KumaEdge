# v0.7 — Optional encrypted scheduled SQLite-only backups

Bunny Magic Containers can host several containers in the same pod with a shared persistent volume. KumaEdge now has an **optional backup sidecar** that periodically snapshots `/app/data/kuma.db` using SQLite's consistent online backup API, encrypts it with **age**, uploads ciphertext over HTTPS into a private Bunny Storage Zone and downloads it to independently verify remote SHA-256 before logging success.

**This is not a full-volume backup.** Uptime Kuma assets outside SQLite are not included. It is not a substitute for the encrypted **offline** full-volume backup workflow described in [FULL_VOLUME_BACKUP.md](FULL_VOLUME_BACKUP.md). Online snapshots can be restored to a *different* installation after a maintenance stop and compatible database schema validation.

## Configure (opt-in)

1. Create a dedicated **private** Bunny Storage Zone in the Bunny dashboard, preferably without a public Pull Zone. Obtain that Zone's WRITE password; **do not use the Bunny account API key**. Pick its primary region code.
2. Generate an `age` keypair on a **trusted offline workstation**. Keep the private identity there; only the `age1...` public recipient goes to the container.
3. Ensure a successful main-branch CI workflow published **both** `ghcr.io/<owner>/kumaedge:<sha>` and `ghcr.io/<owner>/kumaedge-backup:<sha>`, and Bunny's registry identity can pull both.
4. For a NEW INSTALL, use the separate `infra/bunny-with-backup/` Terraform root instead of `infra/bunny/`. Set `backup_storage_zone`, `backup_storage_access_key`, `backup_storage_region`, `backup_age_recipient`, and optionally `backup_interval_hours=24`. Do **not** apply both roots to the same app. Use protected `TF_VAR_...` secrets, never commit a real tfvars file. **Terraform state may contain the Storage Zone password** and must have an encrypted access-controlled state backend.
5. Review `terraform plan`; apply with explicit approval. The sidecar mounts the same volume and exposes no public endpoint. Live deployment has **not been tested** from this chat.

## Expected behavior

- An initial snapshot is attempted after startup; after success it repeats at the configured interval (6–168 hours). After failures, it retries hourly.
- SQLite backup API includes committed WAL transactions and executes `PRAGMA integrity_check`. Raw temp DB snapshots are deleted after encryption; no plaintext archive is uploaded.
- HTTPS Storage API PUT uses `AccessKey` and SHA-256 `Checksum`, followed by an authenticated GET of the complete ciphertext. Only matching-size-and-digest GETs count as a verified offsite backup.
- Each object path contains a UTC date and random suffix. Objects are **not automatically deleted**, avoiding accidental data loss; define a retention policy separately and monitor costs.
- If Storage Zone, recipient, image tag, or credentials are missing, the worker fails closed or reports an error. It cannot decrypt saved archives because no private age identity is present.

## Critical limits

This implementation requires a production deployment and an independently verified restore using your *age private identity*. It cannot guarantee recovery from a lost full volume because uploaded files and non-DB state may exist outside `kuma.db`. Monitoring and alerting for stalled backups, retention deletion, remote disaster recovery, registry access and security review remain operational release gates.

No Bunny credentials or production infrastructure are connected in this conversation. Synthetic tests and provider validation do not equal a live cloud deployment.

## Separate opt-in Terraform root

The Bunny provider currently rejects Terraform `dynamic "container"` blocks during its custom config validation, even when the original app has a regular container block. Rather than risk existing users, the ordinary `infra/bunny/` configuration remains byte-identical. Use `infra/bunny-with-backup/` only for **new installs** and run `terraform init`, `terraform validate`, `terraform plan`, and `terraform apply` from that directory. This second root includes the regular Uptime Kuma container and one optional-feature SQLite backup sidecar as two static container blocks. Both images must be published at the chosen SHA first. Existing installs must carefully migrate Terraform state and review the plan before switching roots; do not use an empty second state on an already deployed app.
