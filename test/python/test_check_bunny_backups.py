import datetime as dt
import importlib.util
import json
from pathlib import Path
import unittest

MODULE = Path(__file__).resolve().parents[2] / "scripts" / "check-bunny-backups.py"
spec = importlib.util.spec_from_file_location("kumaedge_freshness", MODULE)
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)
NOW = dt.datetime(2026, 10, 9, 12, tzinfo=dt.timezone.utc)
FILENAME = "20261009T110000Z-0123456789abcdef.db.age"


def item(name=FILENAME, created="2026-10-09T11:00:12Z", length=128, directory=False):
    return {"ObjectName": name, "DateCreated": created, "Length": length,
            "IsDirectory": directory}


class Response:
    def __init__(self, status=200, contents=b"[]", content_length=None):
        self.status = status
        self.contents = contents
        self.content_length = content_length
        self.offset = 0

    def getheader(self, name):
        return self.content_length if name == "Content-Length" else None

    def read(self, amount):
        result = self.contents[self.offset:self.offset + amount]
        self.offset += len(result)
        return result


class Connection:
    results = {}
    calls = []

    def __init__(self, host, timeout):
        assert host == "storage.bunnycdn.com"
        assert timeout <= 20

    def request(self, method, url, headers=None):
        assert method == "GET"
        assert headers["AccessKey"] == "test-secret"
        assert "test-secret" not in url
        Connection.calls.append(url)
        self.url = url

    def getresponse(self):
        return Connection.results.get(self.url, Response(status=404))

    def close(self):
        pass


class FreshnessTests(unittest.TestCase):
    def setUp(self):
        Connection.calls = []
        Connection.results = {}

    def run_monitor(self, age=36):
        return monitor.newest_backup("private-backup", "test-secret", "de", age, NOW, Connection)

    def put(self, date, objects):
        folder = f"/private-backup/kumaedge/sqlite/{date}/"
        Connection.results[folder] = Response(contents=json.dumps(objects).encode())

    def test_latest_is_fresh(self):
        self.put("2026/10/09", [item()])
        result = self.run_monitor()
        self.assertEqual(result["status"], "present_and_fresh")
        self.assertLess(result["age_hours"], 2)
        self.assertEqual(result["assurance"], "directory_metadata_only_not_a_restore_test")
        self.assertLessEqual(len(Connection.calls), 4)

    def test_empty_storage_fails_closed(self):
        with self.assertRaises(monitor.FreshnessError):
            self.run_monitor()

    def test_stale_backup_fails(self):
        self.put("2026/10/07", [
            item("20261007T010000Z-0123456789abcdef.db.age",
                 "2026-10-07T01:01:00Z")
        ])
        with self.assertRaisesRegex(monitor.FreshnessError, "stale"):
            self.run_monitor()

    def test_bad_backup_metadata_not_accepted(self):
        self.put("2026/10/09", [
            item("20261009T110000Z-0123456789abcdef.db.age", "2026-10-01T00:00:00Z"),
            item(name="../passwd"),
            item(directory=True),
            item(length=0),
            item(created="2099-01-01T00:00:00Z"),
        ])
        with self.assertRaises(monitor.FreshnessError):
            self.run_monitor()

    def test_denied_storage_read_is_not_no_backups(self):
        Connection.results["/private-backup/kumaedge/sqlite/2026/10/09/"] = Response(403)
        with self.assertRaisesRegex(monitor.FreshnessError, "403"):
            self.run_monitor()

    def test_reject_oversized_listing(self):
        Connection.results["/private-backup/kumaedge/sqlite/2026/10/09/"] = Response(
            200, b"x", str(monitor.MAX_LIST_BYTES + 1)
        )
        with self.assertRaises(monitor.FreshnessError):
            self.run_monitor()

    def test_reject_invalid_age(self):
        for age in (0, -1, 5, 169, 36.0, True):
            with self.subTest(age=age), self.assertRaises(monitor.FreshnessError):
                self.run_monitor(age)

    def test_reject_unexpected_host_region(self):
        with self.assertRaises(monitor.FreshnessError):
            monitor.storage_host("evil.example.com")

    def test_no_key_never_makes_request(self):
        with self.assertRaises(monitor.FreshnessError):
            monitor.newest_backup("private-backup", "", "de", 36, NOW, Connection)
        self.assertEqual(Connection.calls, [])


if __name__ == "__main__":
    unittest.main()
