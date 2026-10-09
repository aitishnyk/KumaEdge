import importlib.util
from pathlib import Path
import hashlib
import shutil
import sqlite3
import subprocess
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[2] / "scripts" / "restore-bunny-sqlite.py"
spec = importlib.util.spec_from_file_location("kumaedge_sqlite_restore", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OfflineSqliteRestoreTests(unittest.TestCase):
    def setUp(self):
        self.workspace = tempfile.TemporaryDirectory()
        self.addCleanup(self.workspace.cleanup)
        self.root = Path(self.workspace.name)
        self.database = self.root / "source.db"
        with sqlite3.connect(self.database) as db:
            db.execute("CREATE TABLE monitor(id INTEGER PRIMARY KEY, name TEXT)")
            db.execute("INSERT INTO monitor(name) VALUES ('working')")
        if shutil.which("age") is None or shutil.which("age-keygen") is None:
            self.skipTest("age CLI required; installed on GitHub CI")
        self.identity = self.root / "identity.txt"
        subprocess.run(["age-keygen", "-o", str(self.identity)], check=True,
                       capture_output=True)
        recipient = subprocess.check_output(
            ["age-keygen", "-y", str(self.identity)], text=True).strip()
        self.ciphertext = self.root / "encrypted.age"
        subprocess.run(["age", "-r", recipient, "-o", str(self.ciphertext),
                        str(self.database)], check=True, capture_output=True)

    def test_authenticated_restore_with_ciphertext_receipt(self):
        checksum = hashlib.sha256(self.ciphertext.read_bytes()).hexdigest()
        target = self.root / "new.db"
        report = module.restore(self.ciphertext, self.identity, target, checksum)
        self.assertEqual(report["integrity"], "ok")
        with sqlite3.connect(target) as db:
            self.assertEqual(db.execute("SELECT name FROM monitor").fetchone(), ("working",))

    def test_rejects_wrong_receipt_before_creating_files(self):
        target = self.root / "new.db"
        with self.assertRaises(module.RecoveryError):
            module.restore(self.ciphertext, self.identity, target, "0"*64)
        self.assertFalse(target.exists())

    def test_ciphertext_corruption_rejected_without_output(self):
        tampered = self.root / "tampered.age"
        data = bytearray(self.ciphertext.read_bytes())
        data[-1] ^= 1
        tampered.write_bytes(data)
        target = self.root / "new.db"
        with self.assertRaises(module.RecoveryError):
            module.restore(tampered, self.identity, target)
        self.assertFalse(target.exists())

    def test_existing_file_never_overwritten(self):
        target = self.root / "new.db"
        target.write_bytes(b"KEEP")
        with self.assertRaises(module.RecoveryError):
            module.restore(self.ciphertext, self.identity, target)
        self.assertEqual(target.read_bytes(), b"KEEP")

    def test_rejects_symlinked_archive(self):
        alias = self.root / "alias.age"
        alias.symlink_to(self.ciphertext)
        with self.assertRaises(module.RecoveryError):
            module.restore(alias, self.identity, self.root / "new.db")

    def test_valid_age_but_invalid_sqlite_rejected(self):
        recipient = subprocess.check_output(
            ["age-keygen", "-y", str(self.identity)], text=True).strip()
        raw = self.root / "not-sqlite"
        raw.write_bytes(b"not a sqlite database")
        ciphertext = self.root / "invalid.age"
        subprocess.run(["age", "-r", recipient, "-o", str(ciphertext),
                        str(raw)], check=True, capture_output=True)
        with self.assertRaises(module.RecoveryError):
            module.restore(ciphertext, self.identity, self.root / "new.db")
        self.assertFalse((self.root / "new.db").exists())


if __name__ == "__main__":
    unittest.main()
