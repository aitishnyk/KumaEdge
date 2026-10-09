#!/usr/bin/env python3
"""Offline age-encrypted SQLite restore into a NEW path.

Does not fetch from Bunny, touch /app/data, or manipulate a running service.
Verify/download ciphertext separately; never put age identity or storage keys in logs.
"""
from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import tempfile
import shutil

BLOCK = 1024 * 1024
MAX_ENCRYPTED = 12 * 1024**3


class RecoveryError(ValueError):
    pass


def hash_ciphertext(source: Path) -> tuple[str, int]:
    sha = hashlib.sha256()
    total = 0
    with source.open("rb") as f:
        while chunk := f.read(BLOCK):
            total += len(chunk)
            if total > MAX_ENCRYPTED:
                raise RecoveryError("Encrypted backup too large")
            sha.update(chunk)
    if total == 0:
        raise RecoveryError("Empty encrypted backup")
    return sha.hexdigest(), total


def restore(source: Path, identity: Path, destination: Path, expected_sha256=None):
    if not source.is_file() or source.is_symlink():
        raise RecoveryError("Encrypted source must be a regular file")
    if not identity.is_file() or identity.is_symlink():
        raise RecoveryError("age private identity file missing")
    if destination.exists() or destination.is_symlink():
        raise RecoveryError("Target exists; restoration will never overwrite")
    if not destination.parent.is_dir() or destination.parent.is_symlink():
        raise RecoveryError("Restore parent must be an existing real directory")
    if expected_sha256 is not None and not re.fullmatch(r"[0-9a-f]{64}", expected_sha256):
        raise RecoveryError("Expected SHA-256 must be lowercase 64-character hexadecimal")
    checksum, encrypted_bytes = hash_ciphertext(source)
    if expected_sha256 is not None and checksum != expected_sha256:
        raise RecoveryError("Ciphertext SHA-256 does not match verified backup receipt")
    stage = Path(tempfile.mkdtemp(prefix=".kumaedge-sqlite-restore-", dir=destination.parent))
    os.chmod(stage, 0o700)
    temp_db = stage / "restored.db"
    try:
        result = subprocess.run(
            ["age", "-d", "-i", str(identity), "-o", str(temp_db), str(source)],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=600,
            check=False
        )
        if result.returncode != 0 or not temp_db.is_file() or temp_db.stat().st_size == 0:
            raise RecoveryError("age authentication/decryption failed")
        uri = temp_db.resolve().as_uri() + "?mode=ro"
        try:
            with sqlite3.connect(uri, uri=True) as db:
                if db.execute("PRAGMA integrity_check").fetchone() != ("ok",):
                    raise RecoveryError("Recovered SQLite database failed integrity check")
                if db.execute("SELECT COUNT(*) FROM sqlite_master").fetchone()[0] == 0:
                    raise RecoveryError("Recovered database has no SQLite schema")
        except sqlite3.Error as exc:
            raise RecoveryError("Recovered file is not a valid SQLite database") from exc
        os.chmod(temp_db, 0o600)
        # Atomic, no-overwrite publication within destination filesystem.
        os.link(temp_db, destination)
        return {"target": str(destination), "encrypted_bytes": encrypted_bytes,
                "ciphertext_sha256": checksum, "sqlite_bytes": temp_db.stat().st_size,
                "integrity": "ok"}
    finally:
        shutil.rmtree(stage)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Decrypt an existing age SQLite backup into a NEW verified SQLite database file."
    )
    parser.add_argument("encrypted_archive", type=Path)
    parser.add_argument("age_identity_file", type=Path)
    parser.add_argument("new_sqlite_file", type=Path)
    parser.add_argument("--expected-sha256")
    args = parser.parse_args(argv)
    try:
        report = restore(args.encrypted_archive, args.age_identity_file,
                         args.new_sqlite_file, args.expected_sha256)
    except (RecoveryError, OSError, subprocess.SubprocessError) as exc:
        # No user credential, Bunny Storage key, or age tool stderr echoed.
        print("SQLite restore rejected:", str(exc), file=sys.stderr)
        return 1
    print("Restored verified SQLite:", report["target"], "SQLite bytes:", report["sqlite_bytes"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
