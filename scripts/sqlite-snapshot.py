#!/usr/bin/env python3
"""Create a verified, atomic SQLite snapshot from a locally accessible database.

The SQLite backup API includes committed WAL transactions; copying only kuma.db
while the server is running does not. This utility DOES NOT back up all Uptime
Kuma data (attachments, config, images, etc.) and cannot reach Bunny volumes.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import sqlite3
import stat
import sys
import tempfile
from urllib.parse import quote


def snapshot(source: str, output: str) -> tuple[int, str]:
    src, dest = Path(source).expanduser(), Path(output).expanduser()
    if src.is_symlink():
        raise ValueError("Refusing symlink as source")
    if not src.is_file() or not stat.S_ISREG(src.stat().st_mode):
        raise ValueError("Source must be an existing regular SQLite database")
    if dest.exists() or dest.is_symlink():
        raise FileExistsError("Destination exists; refusing to overwrite it")
    if not dest.parent.is_dir():
        raise ValueError("Destination parent directory does not exist")
    if src.resolve() == dest.resolve():
        raise ValueError("Source and destination must differ")
    # Create a restricted temporary file on the same filesystem for atomic rename.
    fd, tmp = tempfile.mkstemp(prefix=".kumaedge-snapshot-", suffix=".tmp", dir=dest.parent)
    os.fchmod(fd, 0o600)
    os.close(fd)
    try:
        uri = "file:" + quote(str(src.resolve()), safe="/") + "?mode=ro"
        with sqlite3.connect(uri, uri=True, timeout=10) as origin:
            with sqlite3.connect(tmp) as copy:
                origin.backup(copy, pages=128, sleep=0.2)
                result = copy.execute("PRAGMA integrity_check").fetchone()
                if result != ("ok",):
                    raise RuntimeError("Snapshot SQLite integrity check failed")
        if dest.exists() or dest.is_symlink():
            raise FileExistsError("Destination created while snapshot was running")
        os.replace(tmp, dest)
        digest = hashlib.sha256()
        with dest.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                digest.update(chunk)
        return dest.stat().st_size, digest.hexdigest()
    finally:
        try:
            os.unlink(tmp)
        except FileNotFoundError:
            pass


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("Usage: python3 scripts/sqlite-snapshot.py /path/to/kuma.db /private/backup/kuma-2026.db", file=sys.stderr)
        return 2
    try:
        size, sha256 = snapshot(argv[1], argv[2])
    except (OSError, sqlite3.Error, RuntimeError, ValueError) as exc:
        print("Snapshot failed:", exc, file=sys.stderr)
        return 1
    print("Verified SQLite snapshot:", size, "bytes")
    print("SHA-256:", sha256)
    print("Restore only with Uptime Kuma stopped; snapshot excludes non-database files.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
