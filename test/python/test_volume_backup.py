import io
import importlib.util
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[2] / "scripts" / "volume-backup.py"
spec = importlib.util.spec_from_file_location("kumaedge_full_volume", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VolumeBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.volume = self.root / "volume"
        (self.volume / "uploads").mkdir(parents=True)
        (self.volume / "kuma.db").write_bytes(b"db content")
        (self.volume / "uploads" / "test.bin").write_bytes(b"image content")

    def archive(self):
        buff = io.BytesIO()
        module.pack(self.volume, buff)
        return buff.getvalue()

    def test_full_roundtrip_includes_subdirectories(self):
        content = self.archive()
        target = self.root / "restore"
        target.mkdir()
        report = module.unpack(io.BytesIO(content), target)
        self.assertEqual(report["verified_files"], 2)
        self.assertEqual((target / "kuma.db").read_bytes(), b"db content")
        self.assertEqual((target / "uploads" / "test.bin").read_bytes(), b"image content")

    def test_source_symlink_and_hardlink_refused(self):
        link = self.volume / "badlink"
        link.symlink_to(self.root)
        with self.assertRaises(module.UnsafeArchive):
            self.archive()
        link.unlink()
        os.link(self.volume / "kuma.db", self.volume / "hardlink")
        with self.assertRaises(module.UnsafeArchive):
            self.archive()

    def test_wrong_checksum_rejected(self):
        original = self.archive()
        mutated = io.BytesIO()
        with tarfile.open(fileobj=io.BytesIO(original), mode="r:gz") as source:
            with tarfile.open(fileobj=mutated, mode="w:gz") as output:
                for entry in source:
                    content = source.extractfile(entry).read() if entry.isfile() else None
                    if entry.name == "data/kuma.db":
                        content = b"X" + content[1:]
                    output.addfile(entry, io.BytesIO(content) if content is not None else None)
        with self.assertRaises(module.UnsafeArchive):
            module.unpack(io.BytesIO(mutated.getvalue()))

    def test_traversal_member_rejected(self):
        tampered = io.BytesIO()
        with tarfile.open(fileobj=tampered, mode="w:gz") as archive:
            item = tarfile.TarInfo("data/../../outside")
            item.size = 3
            archive.addfile(item, io.BytesIO(b"BAD"))
        with self.assertRaises(module.UnsafeArchive):
            module.unpack(io.BytesIO(tampered.getvalue()), self.root)
        self.assertFalse((self.root.parent / "outside").exists())

    def test_special_member_rejected(self):
        tampered = io.BytesIO()
        with tarfile.open(fileobj=tampered, mode="w:gz") as archive:
            item = tarfile.TarInfo("data/passwd")
            item.type = tarfile.SYMTYPE
            item.linkname = "/etc/passwd"
            archive.addfile(item)
        with self.assertRaises(module.UnsafeArchive):
            module.unpack(io.BytesIO(tampered.getvalue()))

    def test_stopped_writer_attestation_required(self):
        old = os.environ.pop("KUMAEDGE_APP_STOPPED", None)
        try:
            with self.assertRaises(module.UnsafeArchive):
                module.require_stopped()
        finally:
            if old is not None:
                os.environ["KUMAEDGE_APP_STOPPED"] = old


if __name__ == "__main__":
    unittest.main()
