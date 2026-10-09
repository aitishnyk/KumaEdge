#!/usr/bin/env python3
"""Offline authenticated age-encrypted full-volume backup and integrity-checked restore.

Requires local filesystem access, age CLI, and a STOPPED Uptime Kuma writer.
Never claims to read Bunny volumes remotely.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile

SCHEMA = "kumaedge.volume.v1"
MANIFEST = "_kumaedge_manifest.json"
LIMIT_FILES = 100000
LIMIT_FILE = 20 * 1024**3
LIMIT_TOTAL = 100 * 1024**3
CHUNK = 1024 * 1024


class UnsafeArchive(ValueError):
    pass


def entries(root):
    if not root.is_dir() or root.is_symlink():
        raise UnsafeArchive("Source must be a non-symlink directory")
    dirs, files = [], []
    total = 0
    for parent, names, filenames in os.walk(root, followlinks=False):
        names.sort()
        filenames.sort()
        for name in names + filenames:
            path = Path(parent) / name
            metadata = path.lstat()
            if stat.S_ISLNK(metadata.st_mode):
                raise UnsafeArchive("Symlink in source")
            if stat.S_ISDIR(metadata.st_mode):
                dirs.append(path)
            elif stat.S_ISREG(metadata.st_mode):
                if metadata.st_nlink != 1:
                    raise UnsafeArchive("Hardlinked file in source")
                total += metadata.st_size
                if metadata.st_size > LIMIT_FILE or total > LIMIT_TOTAL:
                    raise UnsafeArchive("Source exceeds size limit")
                files.append(path)
            else:
                raise UnsafeArchive("Unsupported special file")
            if len(files) + len(dirs) > LIMIT_FILES:
                raise UnsafeArchive("Source exceeds entry limit")
    return sorted(dirs), sorted(files)


class DigestReader:
    def __init__(self, fp):
        self.fp = fp
        self.digest = hashlib.sha256()
        self.bytes = 0

    def read(self, count):
        data = self.fp.read(count)
        self.digest.update(data)
        self.bytes += len(data)
        return data


def pack(root, stream):
    if root.is_symlink():
        raise UnsafeArchive("Source symlink forbidden")
    root = root.resolve()
    dirs, files = entries(root)
    directory_manifest = []
    file_manifest = []
    with tarfile.open(fileobj=stream, mode="w|gz") as archive:
        top = tarfile.TarInfo("data/")
        top.type = tarfile.DIRTYPE
        top.mode = 0o700
        archive.addfile(top)
        for folder in dirs:
            rel = folder.relative_to(root).as_posix()
            mode = stat.S_IMODE(folder.lstat().st_mode)
            info = tarfile.TarInfo("data/" + rel + "/")
            info.type = tarfile.DIRTYPE
            info.mode = mode
            archive.addfile(info)
            directory_manifest.append([rel, mode])
        for path in files:
            rel = path.relative_to(root).as_posix()
            metadata = path.lstat()
            if not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1:
                raise UnsafeArchive("File changed type during backup")
            flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
            fd = os.open(path, flags)
            with os.fdopen(fd, "rb") as fp:
                actual = os.fstat(fp.fileno())
                if actual.st_ino != metadata.st_ino or actual.st_size != metadata.st_size:
                    raise UnsafeArchive("Source changed during backup")
                info = tarfile.TarInfo("data/" + rel)
                info.mode = stat.S_IMODE(metadata.st_mode)
                info.size = metadata.st_size
                reader = DigestReader(fp)
                archive.addfile(info, reader)
                after = os.fstat(fp.fileno())
                if reader.bytes != metadata.st_size or after.st_size != metadata.st_size or after.st_mtime_ns != metadata.st_mtime_ns:
                    raise UnsafeArchive("Source changed while reading; stop the writer")
                file_manifest.append([rel, metadata.st_size, reader.digest.hexdigest(), info.mode])
        manifest = json.dumps({"schema": SCHEMA, "directories": directory_manifest,
                               "files": file_manifest}, separators=(",", ":")).encode()
        if len(manifest) > 16 * 1024**2:
            raise UnsafeArchive("Manifest too large")
        info = tarfile.TarInfo(MANIFEST)
        info.size = len(manifest)
        info.mode = 0o600
        archive.addfile(info, io.BytesIO(manifest))


def safe_relative(member):
    raw = member.name.rstrip("/") if member.isdir() else member.name
    if not raw.startswith("data/") or "\\" in raw:
        raise UnsafeArchive("Unsafe archive member path")
    rel = raw[5:]
    if any(part in ("", ".", "..") for part in rel.split("/")):
        raise UnsafeArchive("Archive traversal or invalid path")
    return rel


def unpack(stream, stage=None):
    seen = set()
    dirs, files = [], []
    directory_modes = []
    bytes_total = 0
    declared = None
    with tarfile.open(fileobj=stream, mode="r|gz") as archive:
        for member in archive:
            if declared is not None:
                raise UnsafeArchive("Unexpected entry after manifest")
            if member.name in seen:
                raise UnsafeArchive("Repeated archive entry")
            seen.add(member.name)
            if member.isdir() and member.name in ("data", "data/"):
                continue
            if member.name == MANIFEST and member.isfile():
                if member.size > 16 * 1024**2:
                    raise UnsafeArchive("Oversized manifest")
                declared = json.loads(archive.extractfile(member).read())
                continue
            if not (member.isdir() or member.isfile()):
                raise UnsafeArchive("Links and special archive entries refused")
            rel = safe_relative(member)
            if len(dirs) + len(files) >= LIMIT_FILES:
                raise UnsafeArchive("Too many archive entries")
            path = stage / rel if stage is not None else None
            if member.isdir():
                dirs.append([rel, member.mode & 0o777])
                if path is not None:
                    path.mkdir(parents=True, exist_ok=True)
                    directory_modes.append((path, member.mode & 0o777))
                continue
            bytes_total += member.size
            if member.size < 0 or member.size > LIMIT_FILE or bytes_total > LIMIT_TOTAL:
                raise UnsafeArchive("Archive size limit exceeded")
            source = archive.extractfile(member)
            if source is None:
                raise UnsafeArchive("Missing archive data")
            digest = hashlib.sha256()
            if path is not None:
                path.parent.mkdir(parents=True, exist_ok=True)
                output = path.open("xb")
            else:
                output = None
            try:
                remaining = member.size
                while remaining:
                    chunk = source.read(min(CHUNK, remaining))
                    if not chunk:
                        raise UnsafeArchive("Truncated archive")
                    digest.update(chunk)
                    if output is not None:
                        output.write(chunk)
                    remaining -= len(chunk)
            finally:
                if output is not None:
                    output.close()
            files.append([rel, member.size, digest.hexdigest(), member.mode & 0o777])
            if path is not None:
                os.chmod(path, member.mode & 0o777)
    if not isinstance(declared, dict) or declared.get("schema") != SCHEMA:
        raise UnsafeArchive("Unsupported or missing manifest")
    if declared.get("files") != files or declared.get("directories") != dirs:
        raise UnsafeArchive("SHA-256 manifest mismatch")
    for path, mode in reversed(directory_modes):
        os.chmod(path, mode)
    return {"verified_files": len(files), "verified_bytes": bytes_total}


def require_stopped():
    if os.environ.get("KUMAEDGE_APP_STOPPED") != "yes":
        raise UnsafeArchive("Stop the only Uptime Kuma writer, then set KUMAEDGE_APP_STOPPED=yes")


def backup(source, output, recipient):
    require_stopped()
    if not source.is_dir() or source.is_symlink():
        raise UnsafeArchive("Source volume directory missing")
    if output.exists() or output.is_symlink():
        raise UnsafeArchive("Backup destination exists")
    if not output.parent.is_dir():
        raise UnsafeArchive("Backup parent directory missing")
    fd, tmp = tempfile.mkstemp(prefix=".kumaedge-encrypted-", dir=output.parent)
    os.fchmod(fd, 0o600)
    proc = None
    try:
        with os.fdopen(fd, "wb") as ciphertext:
            proc = subprocess.Popen(["age", "-r", recipient], stdin=subprocess.PIPE,
                                    stdout=ciphertext, stderr=subprocess.PIPE)
            try:
                pack(source, proc.stdin)
            finally:
                proc.stdin.close()
            error = proc.stderr.read()
            if proc.wait() != 0:
                raise UnsafeArchive("age encryption failed: " + error.decode(errors="replace")[:300])
        # Atomic exclusive publish; source data never stored as a plaintext tar.
        os.link(tmp, output)
        return output
    except Exception:
        if proc is not None and proc.poll() is None:
            proc.kill()
            proc.wait()
        raise
    finally:
        os.unlink(tmp)


def inspect(archive, identity, target=None):
    if not archive.is_file() or archive.is_symlink():
        raise UnsafeArchive("Encrypted archive missing")
    stage = None
    if target is not None:
        require_stopped()
        if target.exists() or target.is_symlink() or not target.parent.is_dir():
            raise UnsafeArchive("Restore requires a new directory in an existing parent")
        stage = Path(tempfile.mkdtemp(prefix=".kumaedge-restore-", dir=target.parent))
        os.chmod(stage, 0o700)
    proc = subprocess.Popen(["age", "-d", "-i", str(identity), str(archive)],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        result = unpack(proc.stdout, stage)
        proc.stdout.close()
        error = proc.stderr.read()
        if proc.wait() != 0:
            raise UnsafeArchive("age decryption or authentication failed: " + error.decode(errors="replace")[:300])
        if stage is not None:
            if target.exists() or target.is_symlink():
                raise UnsafeArchive("Restore target appeared during extraction")
            os.rename(stage, target)
            stage = None
        return result
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
        if stage is not None:
            shutil.rmtree(stage)


def main(argv):
    try:
        if len(argv) == 5 and argv[1] == "backup":
            result = backup(Path(argv[2]).expanduser(), Path(argv[3]).expanduser(), argv[4])
            print("Encrypted backup created:", result, file=sys.stderr)
        elif len(argv) == 4 and argv[1] == "verify":
            print(inspect(Path(argv[2]).expanduser(), Path(argv[3]).expanduser()))
        elif len(argv) == 5 and argv[1] == "restore":
            result = inspect(Path(argv[2]).expanduser(), Path(argv[3]).expanduser(),
                             Path(argv[4]).expanduser())
            print("Restored to a new directory:", result)
        else:
            print("Usage: volume-backup.py backup SOURCE OUTPUT.age AGE_PUBLIC_KEY | verify ARCHIVE.age AGE_IDENTITY_FILE | restore ARCHIVE.age AGE_IDENTITY_FILE NEW_DIRECTORY", file=sys.stderr)
            return 2
        return 0
    except (UnsafeArchive, OSError, subprocess.SubprocessError, tarfile.TarError,
            ValueError, EOFError, json.JSONDecodeError) as exc:
        print("KumaEdge backup failed:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
