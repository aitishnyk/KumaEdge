#!/usr/bin/env python3
"""Read-only, verified download of ONE age-encrypted SQLite backup from Bunny Storage.

No public Pull Zone. Storage password is read exclusively from an environment
variable; never embed it in CLI args or repository files.
"""
from __future__ import annotations

import argparse
import hashlib
import http.client
import os
from pathlib import Path
import re
import sys
import tempfile

LIMIT = 12 * 1024**3
BLOCK = 1024 * 1024
ZONE = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")
OBJECT = re.compile(r"kumaedge/sqlite/[0-9]{4}/[0-9]{2}/[0-9]{2}/[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}\.db\.age")
REGIONS = {"de", "ny", "la", "sg", "syd", "jh", "uk", "se"}


class DownloadError(ValueError):
    pass


def storage_host(region: str) -> str:
    if region not in REGIONS:
        raise DownloadError("Invalid Bunny Storage primary region")
    return "storage.bunnycdn.com" if region == "de" else region + ".storage.bunnycdn.com"


def download(zone: str, remote_path: str, output: Path, *, region="de",
             key=None, expected_sha256=None,
             connection_factory=http.client.HTTPSConnection) -> dict:
    if not ZONE.fullmatch(zone) or len(zone) < 3:
        raise DownloadError("Invalid private Bunny Storage Zone name")
    if not OBJECT.fullmatch(remote_path):
        raise DownloadError("Remote path must be one exact KumaEdge SQLite backup object")
    if not re.fullmatch(r"[a-f0-9]{64}", expected_sha256 or ""):
        raise DownloadError("Expected verified ciphertext SHA-256 receipt is mandatory")
    if not key:
        raise DownloadError("Missing private Storage Zone access key")
    if output.exists() or output.is_symlink():
        raise DownloadError("Output already exists; refusing overwrite")
    if not output.parent.is_dir() or output.parent.is_symlink():
        raise DownloadError("Output parent must be an existing real directory")
    host = storage_host(region)
    temp_fd, temp_name = tempfile.mkstemp(prefix=".kumaedge-download-", dir=output.parent)
    os.fchmod(temp_fd, 0o600)
    conn = None
    try:
        conn = connection_factory(host, timeout=120)
        conn.request("GET", "/" + zone + "/" + remote_path, headers={
            "AccessKey": key, "Accept": "application/octet-stream"
        })
        response = conn.getresponse()
        if response.status != 200:
            raise DownloadError("Private Bunny Storage download did not return HTTP 200")
        length = response.getheader("Content-Length")
        if length is not None:
            try:
                declared = int(length)
            except ValueError as exc:
                raise DownloadError("Invalid response Content-Length") from exc
            if declared < 1 or declared > LIMIT:
                raise DownloadError("Response length exceeds safe bounds")
        count = 0
        digest = hashlib.sha256()
        with os.fdopen(temp_fd, "wb") as destination:
            temp_fd = -1
            while True:
                data = response.read(BLOCK)
                if not data:
                    break
                count += len(data)
                if count > LIMIT:
                    raise DownloadError("Download too large")
                digest.update(data)
                destination.write(data)
            destination.flush()
            os.fsync(destination.fileno())
        if count == 0 or length is not None and count != declared:
            raise DownloadError("Remote ciphertext truncated or empty")
        if digest.hexdigest() != expected_sha256:
            raise DownloadError("Remote ciphertext does not match verified SHA-256 receipt")
        # Exclusive, atomic publication: no overwrite even on concurrent races.
        os.link(temp_name, output)
        return {"file": str(output), "bytes": count, "sha256": digest.hexdigest()}
    finally:
        if temp_fd >= 0:
            os.close(temp_fd)
        if conn is not None:
            conn.close()
        os.unlink(temp_name)


def main(argv=None):
    parser = argparse.ArgumentParser(description="Verified private Bunny SQLite backup download")
    parser.add_argument("zone")
    parser.add_argument("remote_path")
    parser.add_argument("new_output_file", type=Path)
    parser.add_argument("--region", default="de")
    parser.add_argument("--sha256", required=True,
                        help="Ciphertext SHA-256 printed after successful worker GET readback")
    args = parser.parse_args(argv)
    try:
        outcome = download(args.zone, args.remote_path, args.new_output_file,
                           region=args.region,
                           key=os.environ.get("KUMAEDGE_STORAGE_ACCESS_KEY"),
                           expected_sha256=args.sha256)
        print("Verified encrypted SQLite backup:", outcome["file"], outcome["bytes"], "bytes")
        return 0
    except (DownloadError, OSError, http.client.HTTPException, TimeoutError):
        # Do not print raw network exceptions containing response info or AccessKey.
        print("Bunny Storage read or ciphertext verification failed", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
