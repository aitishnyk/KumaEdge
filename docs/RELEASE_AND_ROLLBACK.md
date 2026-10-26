# Release and rollback

A source commit is not a published image. Local test evidence must match the exact
clean commit and both loaded image config IDs; registry evidence must match both
remote root digests. Never use floating tags for deployment. Local release
verification is independent of GitHub Actions.

Before upgrade, stop the sole writer gracefully and take an encrypted backup of
**all** `/app/data`, including uploads and configuration. Verify decryption,
archive integrity and SQLite `PRAGMA integrity_check`, then restore into a separate
volume and boot an isolated instance. Preserve original volume and backup.

A database migrated by a new engine must not be opened by an old image as a
rollback shortcut. Stop the new writer; restore the pre-upgrade full-volume
backup into a separate volume; start the old pinned image against that restored
volume; validate users, monitors, settings, history and files before routing
traffic. Changes since backup are not recovered. Keep the failed/new volume for
investigation. Never run Terraform destroy or remove existing Bunny volumes.

The local DR harness exercises real Kuma user/monitor/heartbeat preservation.
Bunny volume export, remote restart and remote restore remain separate live gates.
A local restore must never be reported as successful Bunny disaster recovery.
