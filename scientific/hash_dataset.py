"""Write public/data/integrity.json: SHA-256 of the derived dataset files as they are now.

Standard library only. Run from scientific/ AFTER build_scenes.py, validate.py and
build_planets.py (it does not rebuild or change any data):
    python -P hash_dataset.py
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
CORE = ["manifest.json", "sky.json", "planets.json", "validation.json"]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    with open(os.path.join(OUT, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    files = CORE + [s["file"] for s in manifest["sites"]]
    entries = [{"file": rel, "bytes": os.path.getsize(os.path.join(OUT, rel)),
                "sha256": sha256(os.path.join(OUT, rel))} for rel in files]
    doc = {
        "schemaVersion": "1.0.0",
        "purpose": "Identify the exact derived dataset used by the app and by downloaded comparison reports. Hashes cover the files' current bytes; input data hashes are in manifest.provenance.",
        "hashedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "manifestGeneratedAtUtc": manifest.get("generatedAtUtc"),
        "files": entries,
        "generator": "scientific/hash_dataset.py",
    }
    with open(os.path.join(OUT, "integrity.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=1)
    for e in entries:
        print(e["file"], e["sha256"][:12])


if __name__ == "__main__":
    main()
