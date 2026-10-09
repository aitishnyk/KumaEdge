import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

PATH = Path(__file__).resolve().parents[2] / "scripts" / "download-bunny-sqlite.py"
spec = importlib.util.spec_from_file_location("bunny_verified_download", PATH)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

OBJECT = "kumaedge/sqlite/2026/10/09/20261009T120000Z-0123456789abcdef.db.age"
CIPHER = b"age-encrypted-ciphertext"
HASH = hashlib.sha256(CIPHER).hexdigest()

class FakeResponse:
    def __init__(self, status=200, data=CIPHER, length=None):
        self.status = status
        self.data = data
        self.pos = 0
        self.length = length

    def getheader(self, name):
        if name.lower() == "content-length":
            return self.length
        return None

    def read(self, n):
        part = self.data[self.pos:self.pos+n]
        self.pos += len(part)
        return part


class FakeConnection:
    response = FakeResponse()
    requests = []

    def __init__(self, host, timeout):
        assert host == "storage.bunnycdn.com"

    def request(self, method, url, headers):
        assert method == "GET"
        assert headers.get("AccessKey") == "private-test-key"
        FakeConnection.requests.append((method, url))

    def getresponse(self):
        return FakeConnection.response

    def close(self):
        pass


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.path = self.root / "backup.age"
        FakeConnection.response = FakeResponse()
        FakeConnection.requests = []

    def call(self, digest=HASH):
        return worker.download("private-backups", OBJECT, self.path, key="private-test-key",
                               expected_sha256=digest, connection_factory=FakeConnection)

    def test_valid_download_and_SHA_receipt(self):
        report = self.call()
        self.assertEqual(report["sha256"], HASH)
        self.assertEqual(self.path.read_bytes(), CIPHER)
        self.assertEqual(FakeConnection.requests[0][1], "/private-backups/" + OBJECT)

    def test_reject_corrupted_ciphertext_without_output(self):
        FakeConnection.response = FakeResponse(data=b"tampered")
        with self.assertRaises(worker.DownloadError):
            self.call()
        self.assertFalse(self.path.exists())

    def test_reject_incorrect_length_without_output(self):
        FakeConnection.response = FakeResponse(length=str(len(CIPHER) + 100))
        with self.assertRaises(worker.DownloadError):
            self.call()
        self.assertFalse(self.path.exists())

    def test_reject_missing_receipt(self):
        with self.assertRaises(worker.DownloadError):
            self.call(digest=None)
        self.assertEqual(FakeConnection.requests, [])

    def test_existing_output_preserved(self):
        self.path.write_bytes(b"original")
        with self.assertRaises(worker.DownloadError):
            self.call()
        self.assertEqual(self.path.read_bytes(), b"original")

    def test_reject_path_traversal_without_request(self):
        with self.assertRaises(worker.DownloadError):
            worker.download("private-backups", "../../etc/passwd", self.path,
                            key="private-test-key", expected_sha256=HASH,
                            connection_factory=FakeConnection)
        self.assertEqual(FakeConnection.requests, [])

    def test_reject_non_200_response(self):
        FakeConnection.response = FakeResponse(status=403)
        with self.assertRaises(worker.DownloadError):
            self.call()
        self.assertFalse(self.path.exists())


if __name__ == "__main__":
    unittest.main()
