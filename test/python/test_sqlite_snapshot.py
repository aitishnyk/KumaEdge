import importlib.util
from pathlib import Path
import sqlite3
import stat
import tempfile
import unittest


MODULE = Path(__file__).resolve().parents[2] / "scripts" / "sqlite-snapshot.py"
spec = importlib.util.spec_from_file_location("kumaedge_sqlite_snapshot", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "kuma.db"
        self.destination = self.root / "private-backup.db"

    def tearDown(self):
        self.temp.cleanup()

    def test_copies_committed_wal_transactions_and_checks_integrity(self):
        conn = sqlite3.connect(self.source)
        try:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("CREATE TABLE monitors (id INTEGER PRIMARY KEY, name TEXT)")
            conn.execute("INSERT INTO monitors(name) VALUES (?)", ("Site 1",))
            conn.commit()
            size, checksum = module.snapshot(str(self.source), str(self.destination))
            self.assertGreater(size, 0)
            self.assertEqual(len(checksum), 64)
            self.assertEqual(stat.S_IMODE(self.destination.stat().st_mode), 0o600)
            with sqlite3.connect(self.destination) as restored:
                self.assertEqual(restored.execute("SELECT name FROM monitors").fetchall(), [("Site 1",)])
                self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone(), ("ok",))
        finally:
            conn.close()

    def test_rejects_overwriting_existing_backup(self):
        with sqlite3.connect(self.source) as conn:
            conn.execute("CREATE TABLE t (id INTEGER)")
        self.destination.write_bytes(b"preserve-this")
        with self.assertRaises(FileExistsError):
            module.snapshot(str(self.source), str(self.destination))
        self.assertEqual(self.destination.read_bytes(), b"preserve-this")

    def test_rejects_symlink_source(self):
        with sqlite3.connect(self.source) as conn:
            conn.execute("CREATE TABLE t (id INTEGER)")
        symlink = self.root / "linked.db"
        symlink.symlink_to(self.source)
        with self.assertRaises(ValueError):
            module.snapshot(str(symlink), str(self.destination))


if __name__ == "__main__":
    unittest.main()
