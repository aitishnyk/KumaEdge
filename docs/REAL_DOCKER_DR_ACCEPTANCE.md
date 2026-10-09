# v0.12 — Real Docker disaster-recovery rehearsal

GitHub now tests real **Uptime Kuma v2** with disposable Docker volumes before GHCR publication.

The `scripts/smoke-disaster-recovery.sh` acceptance starts an actual Uptime Kuma container, verifies its SQLite database and creates a synthetic marker on the persistent volume. It then stops the sole writer, copies the whole volume into temporary storage, encrypts it with **age**, decrypts and checks a SHA-256 manifest, restores into a **second Docker named volume**, and boots a fresh Uptime Kuma container to prove the marker and database survive.

The rehearsal deletes all test containers, named volumes, age keys and archives on exit. It never uses customer data, any Bunny account or a production storage key.

This is a materially stronger test than a unit test with fake SQLite files. Nevertheless, it is **not** a claim that a real Bunny Magic Containers volume has been exported or restored. Real Bunny acceptance must separately validate storage access, volume ownership, production account/2FA, notifications, encrypted full-volume backups, schema-compatible rollback and the public HTTPS front door.

The original Uptime Kuma v2 installation requires a POSIX-compatible filesystem for SQLite locks. Do not assume NFS or other incompatible shared storage is safe. See [Production Operations](PRODUCTION_OPERATIONS.md) and [the actual Bunny launch gate](https://github.com/aitishnyk/KumaEdge/issues/19).
