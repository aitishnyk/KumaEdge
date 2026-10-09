# KumaEdge v0.6 — Full-volume encrypted offline backup

**This is an operator-side utility, not a remote Bunny volume backup.** It needs local, authorized access to the entire contents of the Bunny Magic Containers persistent volume. The repository has no authenticated Bunny API connector, and no automated volume export or offsite replication is claimed.

## Requirements

Python 3.11+, [age CLI](https://github.com/FiloSottile/age), a trusted filesystem, and an **offline/stopped Uptime Kuma process**. Save the age identity outside the volume, GitHub and backup destination. The archive can contain admin passwords, tokens and every monitor configuration.

## Create encrypted backup

After stopping the *only* Uptime Kuma process and obtaining an exact local copy/mount of the **entire** `/app/data`:

```sh
export KUMAEDGE_APP_STOPPED=yes
python3 scripts/volume-backup.py backup /private/kuma-data /private/backups/kuma-2026-10-09.age 'age1PUBLIC_RECIPIENT'
```

The backup tool refuses symlinks, hardlinked files, special entries, excessively large volumes, modified files during reading, and existing backup destinations. It streams the tar archive directly to age encryption (no plaintext archive file). Output mode is 0600. The age recipient must be the intended public key; never put private keys on the command line.

## Verify and restore

```sh
python3 scripts/volume-backup.py verify /private/backups/kuma-2026-10-09.age /private/age-identity.txt
export KUMAEDGE_APP_STOPPED=yes
python3 scripts/volume-backup.py restore /private/backups/kuma-2026-10-09.age /private/age-identity.txt /private/new-kuma-volume
```

Verification checks an encrypted age envelope, per-file SHA-256 manifest and path safety. Restore refuses an existing directory and stages contents in a temporary sibling before publish. It refuses malicious symlinks/special members, traversal, extra records and changed bytes.

**UID/GID ownership is not preserved.** Adjust restored directory ownership for the actual container user before mounting it. Do a restore drill against an isolated Bunny app; a verified local archive is not proof of remote backup success.

## Limitations and operational safety

- `KUMAEDGE_APP_STOPPED=yes` is an **operator assertion**, not an automated check. Do not set it while Uptime Kuma runs. For a live database, use the separate SQLite snapshot utility for partial database-only backups, not this full-volume tool.
- Files larger than 20 GiB, total volumes above 100 GiB, and directories with over 100,000 entries are rejected.
- The age identity and Terraform state must be backed up independently in a secure location. Loss of the private age identity makes the archive undecryptable.
- A live Bunny export mechanism, scheduled automated offsite backups, real Bunny production restore acceptance still requires deployment environment access. The committed unit tests validate archive logic with synthetic data.
