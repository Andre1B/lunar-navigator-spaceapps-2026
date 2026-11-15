"""Fetch only missing/changed pinned inputs; never call Horizons or run code.

python fetch_sources.py --check-only
python fetch_sources.py
All transfers are serial HTTPS, staged to .part, hash-verified before replace.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import urllib.request


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    lock = json.loads((here/"source-lock.json").read_text(encoding="utf-8"))
    for item in lock.get("references", []):
        path = here/item["relativePath"]
        if not path.is_file() or sha(path) != item["sha256"]:
            raise ValueError(f"Bundled reference mismatch: {path}")
    for item in lock["files"]:
        path = here/"cache"/item["cachePath"]
        if path.is_file() and sha(path) == item["sha256"]:
            print("OK", item["cachePath"], flush=True)
            continue
        if args.check_only:
            raise FileNotFoundError(f"Pinned input missing or changed: {path}")
        if not item["url"].startswith("https://"):
            raise ValueError("Source transfers require HTTPS")
        path.parent.mkdir(parents=True, exist_ok=True)
        part = path.with_suffix(path.suffix+".part")
        request = urllib.request.Request(item["url"], headers={"User-Agent": "LunarNavigator-source-lock/1.0"})
        print("FETCH", item["url"], flush=True)
        with urllib.request.urlopen(request, timeout=180) as response, part.open("wb") as dest:
            while chunk := response.read(1 << 20):
                dest.write(chunk)
        if sha(part) != item["sha256"]:
            part.unlink()
            raise ValueError(f"Source hash mismatch; original kept: {path}")
        os.replace(part, path)
    print("All pinned inputs and bundled historical Horizons references verified.", flush=True)


if __name__ == "__main__":
    main()
