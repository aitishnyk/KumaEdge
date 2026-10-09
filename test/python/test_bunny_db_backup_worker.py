import datetime
import hashlib
import importlib.util
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[2] / "scripts" / "bunny-db-backup-worker.py"
spec = importlib.util.spec_from_file_location("kumaedge_backup_worker", MODULE)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class FakeResponse:
    def __init__(self, status, data=b""):
        self.status = status
        self.data = data
        self.offset = 0

    def read(self, count=-1):
        if count < 0:
            count = len(self.data)
        part = self.data[self.offset:self.offset + count]
        self.offset += len(part)
        return part


class FakeConnection:
    objects = {}
    failure = None
    requests = []

    def __init__(self, host, timeout):
        assert host == "storage.bunnycdn.com"
        self.host = host

    def request(self, method, url, body=None, headers=None):
        self.method, self.url = method, url
        self.headers = headers
        self.requests.append((method, url))
        if method == "PUT":
            data = body.read()
            assert len(data) == int(headers["Content-Length"])
            assert hashlib.sha256(data).hexdigest().upper() == headers["Checksum"]
            self.objects[url] = data

    def getresponse(self):
        if self.failure:
            return FakeResponse(self.failure)
        return FakeResponse(201 if self.method == "PUT" else 200,
                            self.objects.get(self.url, b"") if self.method == "GET" else b"")

    def close(self):
        pass


class WorkerTests(unittest.TestCase):
    def setUp(self):
        FakeConnection.objects = {}
        FakeConnection.failure = None
        FakeConnection.requests = []
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "data"
        self.source.mkdir()
        self.conn = sqlite3.connect(self.source / "kuma.db")
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("CREATE TABLE monitors(id INTEGER PRIMARY KEY, name TEXT)")
        self.conn.execute("INSERT INTO monitors(name) VALUES ('example')")
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def test_wal_online_snapshot_includes_committed_records(self):
        dest = self.root / "snapshot.db"
        worker.snapshot_database(self.source, dest)
        with sqlite3.connect(dest) as recovered:
            self.assertEqual(recovered.execute("SELECT name FROM monitors").fetchall(),
                             [("example",)])
            self.assertEqual(recovered.execute("PRAGMA integrity_check").fetchone(), ("ok",))

    def test_host_path_and_configuration_are_restricted(self):
        self.assertEqual(worker.storage_host("de"), "storage.bunnycdn.com")
        with self.assertRaises(worker.BackupError):
            worker.storage_host("evil.example.net")
        name = worker.remote_path(datetime.datetime(2026, 10, 9,
                                tzinfo=datetime.timezone.utc), "a" * 16)
        self.assertEqual(name, "kumaedge/sqlite/2026/10/09/20261009T000000Z-aaaaaaaaaaaaaaaa.db.age")
        cfg = {"KUMAEDGE_BACKUP_VOLUME": str(self.source),
               "KUMAEDGE_STORAGE_ZONE": "private-backup",
               "KUMAEDGE_STORAGE_ACCESS_KEY": "not-a-real-secret",
               "KUMAEDGE_AGE_RECIPIENT": "invalid"}
        with self.assertRaises(worker.BackupError):
            worker.config_from_env(cfg)

    def test_upload_and_get_sha_must_match(self):
        testfile = self.root / "encrypted.age"
        testfile.write_bytes(b"encrypted-ciphertext")
        cfg = {"zone": "private-backup", "key": "fake-key", "region": "de"}
        result = worker.upload_verified(testfile, cfg, connection_factory=FakeConnection,
                  now=datetime.datetime(2026,10,9,tzinfo=datetime.timezone.utc),
                  random_id="f"*16)
        self.assertTrue(result["verified"])
        self.assertEqual([r[0] for r in FakeConnection.requests], ["PUT","GET"])
    
    def test_end_to_end_real_age_if_installed(self):
        if not shutil.which("age") or not shutil.which("age-keygen"):
            self.skipTest("age not installed; CI installs age")
        identity = self.root / "identity.txt"
        subprocess.run(["age-keygen","-o",str(identity)],check=True,capture_output=True)
        recipient = subprocess.check_output(["age-keygen","-y",str(identity)],text=True).strip()
        cfg = {"volume": self.source, "zone": "private-backup", "key": "fake-key",
               "region": "de", "recipient": recipient, "interval": 24}
        result = worker.run_once(cfg, connection_factory=FakeConnection)
        self.assertTrue(result["verified"])
        encrypted = list(FakeConnection.objects.values())[0]
        ciphertext = self.root / "download.age"
        ciphertext.write_bytes(encrypted)
        restored = self.root / "restored.db"
        subprocess.run(["age","-d","-i",str(identity),"-o",str(restored),str(ciphertext)],
                       check=True,capture_output=True)
        with sqlite3.connect(restored) as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM monitors").fetchone()[0],1)
