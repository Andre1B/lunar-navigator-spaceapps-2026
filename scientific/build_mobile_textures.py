"""1024x512 mobile variants of the visual textures (appearance only).

Each is a Lanczos downsample of the existing 2048x1024 file in public/data;
no source is re-downloaded and no scientific data is touched.
Run from scientific/ after the other builders:  PYTHONPATH=. python -P build_mobile_textures.py
"""
from __future__ import annotations

import hashlib
import json
import os

from PIL import Image

import build_scenes as B

JOBS = [
    ("globe/moon-color-lroc-2048x1024.jpg", "globe/moon-color-lroc-1024x512.jpg", "RGB"),
    ("globe/earth-visual-2k.jpg", "globe/earth-visual-1k.jpg", "RGB"),
    ("globe/earth-clouds-illustrative-2k.jpg", "globe/earth-clouds-illustrative-1k.jpg", "L"),
    ("globe/earth-ocean-specular-2k.jpg", "globe/earth-ocean-specular-1k.jpg", "L"),
    ("starmap/starmap-2020-celestial-2048x1024.jpg", "starmap/starmap-2020-celestial-1024x512.jpg", "RGB"),
]


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def main():
    out = []
    for src, dst, mode in JOBS:
        s = os.path.join(B.OUT, src)
        d = os.path.join(B.OUT, dst)
        im = Image.open(s).convert(mode).resize((1024, 512), Image.Resampling.LANCZOS)
        im.save(d, quality=88, optimize=True, progressive=True, **({"subsampling": 0} if mode == "RGB" else {}))
        out.append({"file": dst, "derivedFrom": src, "derivedFromSha256": sha(s),
                    "width": 1024, "height": 512, "bytes": os.path.getsize(d), "sha256": sha(d)})
    meta = {
        "schemaVersion": B.SCHEMA_VERSION,
        "purpose": "Mobile texture variants for screens about 720 px wide or less. Visual only; grids, UV conventions, sources, licences and credits are those of the parent files (see globe/visual-assets.json, globe/earth-layers.json, starmap/starmap.json).",
        "conversion": "Lanczos downsample of the 2048x1024 parent to 1024x512, JPEG q88 (4:4:4 for colour). No colour or content change.",
        "files": out,
        "notes": [
            "Star map at 1024x512 is about 0.35 deg per pixel: individual faint stars average into the background and look dimmer; star positions are unchanged.",
            "Specular and cloud layers keep their illustrative status (Solar System Scope, CC BY 4.0).",
        ],
        "generator": "scientific/build_mobile_textures.py",
    }
    with open(os.path.join(B.OUT, "globe", "mobile-textures.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    for o in out:
        print(o["file"], o["bytes"])


if __name__ == "__main__":
    main()
