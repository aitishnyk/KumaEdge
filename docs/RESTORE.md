# Restore

Read [full-volume backup](FULL_VOLUME_BACKUP.md) first. Keep the age identity separate from encrypted archives; never paste it in chat. Verify the archive SHA256 and manifest before trusting a restore.

```bash
python3 scripts/volume-backup.py --help
```

The restore subcommand requires archive, identity file and a **new empty destination**, and `KUMAEDGE_APP_STOPPED=yes` to acknowledge a stopped writer. Use a disposable local Docker volume and network isolation for the first drill. Inspect SQLite integrity, users, monitors, Status Pages, settings and assets; then start only one writer. Do not point a test restore at the live volume. Production restoration needs a separately reviewed shutdown/restore/restart procedure and private infrastructure state. A local successful drill is not a Bunny-to-Bunny restore certification.
