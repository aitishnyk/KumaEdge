#!/usr/bin/env python3
"""Read-only backup freshness monitor using Bunny Storage directory metadata.

Does not create, decrypt, delete, or download backup objects. A fresh object
is evidence of presence, NOT cryptographic proof of recoverability.
"""
from __future__ import annotations

import argparse
import datetime as dt
import http.client
import json
import math
import os
import re
import sys

MAX_LIST_BYTES = 2 * 1024 * 1024
MAX_OBJECTS = 10000
MAX_ENCRYPTED_BYTES = 12 * 1024**3
DAY = dt.timedelta(days=1)
UTC = dt.timezone.utc
VALID_REGIONS = frozenset(("de", "ny", "la", "sg", "syd", "jh", "uk", "se"))
ZONE = re.compile(r"[a-z0-9][a-z0-9_-]{2,63}\Z")
OBJECT = re.compile(r"(?P<timestamp>\d{8}T\d{6}Z)-[0-9a-f]{16}\.db\.age\Z")


class FreshnessError(RuntimeError):
    pass


def storage_host(region: str) -> str:
    if region not in VALID_REGIONS:
        raise FreshnessError("Unsupported Storage Zone primary region")
    return "storage.bunnycdn.com" if region == "de" else region + ".storage.bunnycdn.com"


def validate_age_hours(value: int) -> int:
    if type(value) is not int or not 6 <= value <= 168:
        raise FreshnessError("Maximum allowed backup age must be 6–168 whole hours")
    return value


def parse_created(value: object) -> dt.datetime:
    if not isinstance(value, str):
        raise FreshnessError("Missing remote DateCreated metadata")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise FreshnessError("Malformed DateCreated metadata") from exc
    # Bunny's older Storage API objects can return UTC without an explicit Z.
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def list_directory(zone: str, day: dt.date, key: str, region: str,
                   connection_factory=http.client.HTTPSConnection) -> list:
    if not ZONE.fullmatch(zone):
        raise FreshnessError("Invalid Storage Zone name")
    if not key:
        raise FreshnessError("Missing private Storage Zone access key")
    host = storage_host(region)
    url = f"/{zone}/kumaedge/sqlite/{day:%Y/%m/%d}/"
    conn = connection_factory(host, timeout=20)
    try:
        conn.request("GET", url, headers={
            "AccessKey": key,
            "Accept": "application/json"
        })
        response = conn.getresponse()
        if response.status == 404:
            response.read(1024)
            return []  # Directory never created. Look at older days.
        if response.status != 200:
            response.read(1024)
            raise FreshnessError("Bunny Storage directory list HTTP " + str(response.status))
        declared = response.getheader("Content-Length")
        if declared is not None:
            try:
                length = int(declared)
            except ValueError as exc:
                raise FreshnessError("Invalid listing Content-Length") from exc
            if length < 0 or length > MAX_LIST_BYTES:
                raise FreshnessError("Bunny Storage directory listing exceeds size limit")
        payload = response.read(MAX_LIST_BYTES + 1)
        if len(payload) > MAX_LIST_BYTES:
            raise FreshnessError("Bunny Storage directory listing exceeds size limit")
        try:
            objects = json.loads(payload)
        except (UnicodeDecodeError, ValueError) as exc:
            raise FreshnessError("Malformed Bunny Storage directory JSON") from exc
        if not isinstance(objects, list) or len(objects) > MAX_OBJECTS:
            raise FreshnessError("Invalid/oversized Bunny Storage directory listing")
        return objects
    finally:
        conn.close()


def newest_backup(zone: str, key: str, region: str, max_age_hours: int,
                  now: dt.datetime | None = None,
                  connection_factory=http.client.HTTPSConnection) -> dict:
    threshold = validate_age_hours(max_age_hours)
    if not ZONE.fullmatch(zone) or not key:
        raise FreshnessError("Missing/invalid private Storage Zone configuration")
    if now is None:
        now = dt.datetime.now(UTC)
    if now.tzinfo is None:
        raise FreshnessError("Monitoring clock must be timezone aware")
    now = now.astimezone(UTC)
    # Include the day preceding the lookback boundary (bounded <=9 requests).
    lookback = math.ceil(threshold / 24) + 1
    latest = None
    valid_count = 0
    for i in range(lookback + 1):
        day = now.date() - i * DAY
        for entry in list_directory(zone, day, key, region, connection_factory):
            if not isinstance(entry, dict) or entry.get("IsDirectory") is not False:
                continue
            filename = entry.get("ObjectName")
            if not isinstance(filename, str):
                continue
            matched = OBJECT.fullmatch(filename)
            if not matched:
                continue
            length = entry.get("Length")
            if type(length) is not int or not 1 <= length <= MAX_ENCRYPTED_BYTES:
                continue
            created = parse_created(entry.get("DateCreated"))
            try:
                name_time = dt.datetime.strptime(
                    matched.group("timestamp"), "%Y%m%dT%H%M%SZ"
                ).replace(tzinfo=UTC)
            except ValueError:
                continue
            if name_time.date() != day:
                continue
            # Reject objects with timestamps inconsistent with the upload name.
            if abs((created - name_time).total_seconds()) > 3600:
                continue
            if created > now + dt.timedelta(minutes=5):
                continue
            valid_count += 1
            if latest is None or created > latest["created"]:
                latest = {"created": created, "encrypted_bytes": length}
    if latest is None:
        raise FreshnessError("No eligible SQLite backups found in the lookback window")
    age_hours = max(0.0, (now - latest["created"]).total_seconds() / 3600)
    if age_hours > threshold:
        raise FreshnessError(
            f"Newest SQLite backup is stale: {age_hours:.1f}h (maximum {threshold}h)"
        )
    return {
        "status": "present_and_fresh",
        "latest_created_utc": latest["created"].isoformat(),
        "age_hours": round(age_hours, 2),
        "encrypted_bytes": latest["encrypted_bytes"],
        "eligible_objects": valid_count,
        "assurance": "directory_metadata_only_not_a_restore_test",
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Check encrypted Bunny SQLite backup freshness")
    parser.add_argument("--max-age-hours", type=int, default=36)
    args = parser.parse_args(argv)
    try:
        result = newest_backup(
            os.environ.get("KUMAEDGE_STORAGE_ZONE", ""),
            os.environ.get("KUMAEDGE_STORAGE_ACCESS_KEY", ""),
            os.environ.get("KUMAEDGE_STORAGE_REGION", "de").lower(),
            args.max_age_hours
        )
        print(json.dumps(result, sort_keys=True))
        return 0
    except (FreshnessError, OSError, http.client.HTTPException, TimeoutError):
        # Avoid logging network exceptions, response content, AccessKey or zone URL.
        print("KumaEdge SQLite backup freshness FAILED or unavailable", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
