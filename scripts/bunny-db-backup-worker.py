#!/usr/bin/env python3
"""Opt-in Bunny Storage offsite *SQLite-only* backups from a live KumaEdge pod.

Uses SQLite online backup API, age encryption, authenticated HTTPS Storage API PUT,
and full ciphertext GET+SHA256 verification. Never handles or logs a decryption key.
No files outside the database are backed up. No account-level Bunny API key needed.
"""
from __future__ import annotations

import datetime
import hashlib
import http.client
import os
from pathlib import Path
import re
import secrets
import sqlite3
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote

SUPPORTED_REGIONS = {"de", "ny", "la", "sg", "syd", "jh", "uk", "se"}
MAX_DB_BYTES = 10 * 1024 ** 3
BLOCK = 1024 * 1024


class BackupError(RuntimeError):
    pass


def config_from_env(env=os.environ):
    volume = Path(env.get("KUMAEDGE_BACKUP_VOLUME", "/data"))
    zone = env.get("KUMAEDGE_STORAGE_ZONE", "")
    key = env.get("KUMAEDGE_STORAGE_ACCESS_KEY", "")
    region = env.get("KUMAEDGE_STORAGE_REGION", "de").lower()
    recipient = env.get("KUMAEDGE_AGE_RECIPIENT", "")
    raw_interval = env.get("KUMAEDGE_BACKUP_INTERVAL_HOURS", "24")
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{2,63}", zone):
        raise BackupError("Invalid or missing private Bunny storage zone")
    if not key:
        raise BackupError("Missing storage zone write access key")
    if region not in SUPPORTED_REGIONS:
        raise BackupError("Unsupported storage region code")
    if not re.fullmatch(r"age1[023456789acdefghjklmnpqrstuvwxyz]{25,130}", recipient):
        raise BackupError("Invalid age recipient public key")
    try:
        interval = int(raw_interval)
    except ValueError as exc:
        raise BackupError("Invalid backup interval") from exc
    if not 6 <= interval <= 168:
        raise BackupError("Backup interval must be between 6 and 168 hours")
    if not volume.is_dir() or volume.is_symlink():
        raise BackupError("Backup volume missing or symlinked")
    return {"volume": volume, "zone": zone, "key": key, "region": region,
            "recipient": recipient, "interval": interval}


def storage_host(region):
    if region not in SUPPORTED_REGIONS:
        raise BackupError("Unsupported Bunny Storage region")
    return "storage.bunnycdn.com" if region == "de" else region + ".storage.bunnycdn.com"


def snapshot_database(volume, destination):
    source = volume / "kuma.db"
    if source.is_symlink() or not source.is_file():
        raise BackupError("SQLite source kuma.db is missing or symlinked")
    if source.stat().st_size > MAX_DB_BYTES:
        raise BackupError("SQLite source exceeds configured backup size limit")
    uri = source.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=30) as live:
        with sqlite3.connect(destination) as copy:
            live.backup(copy, pages=256, sleep=0.1)
            if copy.execute("PRAGMA integrity_check").fetchone() != ("ok",):
                raise BackupError("SQLite online backup integrity check failed")
    if destination.stat().st_size > MAX_DB_BYTES:
        raise BackupError("Backup SQLite copy exceeds configured size limit")
    return destination.stat().st_size


def encrypt_database(snapshot, encrypted, recipient):
    result = subprocess.run(
        ["age", "-r", recipient, "-o", str(encrypted), str(snapshot)],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        check=False, timeout=600,
    )
    if result.returncode != 0:
        raise BackupError("age encryption failed")
    if not encrypted.is_file() or encrypted.stat().st_size <= 0:
        raise BackupError("Encrypted output empty")


def digest_file(path):
    digest = hashlib.sha256()
    count = 0
    with path.open("rb") as stream:
        while True:
            block = stream.read(BLOCK)
            if not block:
                break
            digest.update(block)
            count += len(block)
    return digest.hexdigest(), count


def remote_path(now, random_id):
    if now.tzinfo is None:
        raise BackupError("Backup time must include timezone")
    utc = now.astimezone(datetime.timezone.utc)
    stamp = utc.strftime("%Y%m%dT%H%M%SZ")
    if not re.fullmatch(r"[a-f0-9]{16}", random_id):
        raise BackupError("Invalid backup ID")
    return f"kumaedge/sqlite/{utc:%Y/%m/%d}/{stamp}-{random_id}.db.age"


def upload_verified(path, cfg, connection_factory=http.client.HTTPSConnection,
                    now=None, random_id=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    random_id = random_id or secrets.token_hex(8)
    name = remote_path(now, random_id)
    target = "/" + quote(cfg["zone"], safe="") + "/" + name
    host = storage_host(cfg["region"])
    expected_hash, size = digest_file(path)
    if size < 1:
        raise BackupError("Refusing zero-byte upload")
    headers = {
        "AccessKey": cfg["key"],
        "Content-Type": "application/octet-stream",
        "Content-Length": str(size),
        "Checksum": expected_hash.upper(),
    }
    conn = connection_factory(host, timeout=120)
    try:
        with path.open("rb") as stream:
            conn.request("PUT", target, body=stream, headers=headers)
            response = conn.getresponse()
            status = response.status
            response.read(1024)
            if status not in (200, 201, 204):
                raise BackupError("Bunny Storage PUT failed with HTTP " + str(status))
    finally:
        conn.close()
    # Read back ALL bytes to verify actual remote stored ciphertext.
    conn = connection_factory(host, timeout=120)
    try:
        conn.request("GET", target, headers={"AccessKey": cfg["key"]})
        response = conn.getresponse()
        if response.status != 200:
            raise BackupError("Bunny Storage verification GET failed: " + str(response.status))
        actual = hashlib.sha256()
        read = 0
        while True:
            block = response.read(BLOCK)
            if not block:
                break
            read += len(block)
            if read > size:
                raise BackupError("Remote backup is larger than uploaded file")
            actual.update(block)
        if read != size or actual.hexdigest() != expected_hash:
            raise BackupError("Remote ciphertext SHA-256 verification failed")
    finally:
        conn.close()
    return {"remote_path": name, "encrypted_bytes": size,
            "ciphertext_sha256": expected_hash, "verified": True}


def run_once(cfg, *, connection_factory=http.client.HTTPSConnection):
    # Local temporary unencrypted SQLite snapshot: never store it on a public mount.
    # Local sandbox filesystem is ephemeral. Archive transfer is always encrypted.
    with tempfile.TemporaryDirectory(prefix="kumaedge-db-backup-") as scratch:
        os.chmod(scratch, 0o700)
        db = Path(scratch) / "snapshot.db"
        encrypted = Path(scratch) / "snapshot.db.age"
        snapshot_database(cfg["volume"], db)
        os.chmod(db, 0o600)
        encrypt_database(db, encrypted, cfg["recipient"])
        db.unlink()
        return upload_verified(encrypted, cfg, connection_factory=connection_factory)


def main(argv):
    try:
        cfg = config_from_env()
        once = len(argv) == 2 and argv[1] == "--once"
        if len(argv) > 2 or len(argv) == 2 and not once:
            raise BackupError("Usage: bunny-db-backup-worker.py [--once]")
        while True:
            try:
                report = run_once(cfg)
                print("Backup verified:", report["remote_path"], "bytes:", report["encrypted_bytes"],
                      flush=True)
                if once:
                    return 0
                delay = cfg["interval"] * 3600
            except (BackupError, sqlite3.Error, OSError, subprocess.SubprocessError,
                    http.client.HTTPException, TimeoutError) as exc:
                # Avoid printing raw exceptions: some exceptions can contain URLs or access keys.
                print("Backup failed (no successful remote verification)", file=sys.stderr, flush=True)
                if once:
                    return 1
                delay = 3600
            time.sleep(delay)
    except BackupError as exc:
        print("Backup worker configuration invalid:", exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
