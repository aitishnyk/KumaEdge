# Full-volume encrypted backup and verification

The offline archive utility needs authorized access to the complete data tree with the only writer stopped. The current reference deployment also has an explicitly protected engine export operation: OWNER Basic plus a separate ops capability; fixed age recipient; loopback engine listener; no path or recipient supplied by HTTP. The private, app-scoped `scripts/local/bunny-full-backup.py` exports the actual reference volume and verifies an isolated local restore. New installations must configure their own ops capability/recipient and backup procedure; the maintainer wrapper is not a generic remote client. No scheduled offsite replication is claimed.

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

**UID/GID ownership is not preserved.** Adjust restored directory ownership for the actual container user before mounting it. Do an isolated local restore drill first. A local archive is not a certification of Bunny-to-Bunny recovery; the reference task forbids additional cloud resources.

## Limitations and operational safety

- `KUMAEDGE_APP_STOPPED=yes` is an **operator assertion**, not an automated check. Do not set it while Uptime Kuma runs. For a live database, use the separate SQLite snapshot utility for partial database-only backups, not this full-volume tool.
- Files larger than 20 GiB, total volumes above 100 GiB, and directories with over 100,000 entries are rejected.
- The age identity and Terraform state must be backed up independently in a secure location. Loss of the private age identity makes the archive undecryptable.
- The reference engine export and real Bunny-source backup/local restore are live-verified. Scheduled automated offsite replication and Bunny-to-Bunny recovery remain unverified. Unit tests validate adversarial archive behavior; Docker acceptance validates actual engine data.
