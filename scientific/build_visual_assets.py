"""Web-sized visual textures -> public/data/globe/ (appearance only).

- Moon colour: NASA SVS CGI Moon Kit lroc_color_16bit_srgb_4k.tif (4096x2048,
  16-bit sRGB) -> 8-bit sRGB JPEG, same grid as moon-elevation (centred on 0 deg).
- Earth colour: public/assets/earth-blue-marble-2004-03.png (read only, not
  modified) -> 2048x1024 JPEG.
Run from scientific/:  PYTHONPATH=. python -P build_visual_assets.py   (needs Pillow)
"""
from __future__ import annotations

import hashlib
import json
import os

import numpy as np
import tifffile
from PIL import Image

import build_scenes as B

OUT_DIR = os.path.join(B.OUT, "globe")
MOON_SRC = os.path.join(B.CACHE, "svs", "lroc_color_16bit_srgb_4k.tif")
MOON_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif"
EARTH_SRC = os.path.join(B.HERE, "..", "public", "assets", "earth-blue-marble-2004-03.png")


def sha_file(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def save(im, name, quality):
    path = os.path.join(OUT_DIR, name)
    im.save(path, quality=quality, optimize=True, progressive=True, subsampling=0)
    return {"file": f"globe/{name}", "width": im.size[0], "height": im.size[1],
            "bytes": os.path.getsize(path), "sha256": sha_file(path)}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    a16 = tifffile.imread(MOON_SRC)
    if a16.shape != (2048, 4096, 3) or a16.dtype != np.uint16:
        raise ValueError("unexpected LROC colour map")
    a8 = np.round(a16.astype(np.float64) / 257.0).astype(np.uint8)  # already sRGB-encoded
    moon = save(Image.fromarray(a8), "moon-color-lroc-4096x2048.jpg", 90)
    moon_small = save(Image.fromarray(a8).resize((2048, 1024), Image.Resampling.LANCZOS),
                      "moon-color-lroc-2048x1024.jpg", 90)

    earth_im = Image.open(EARTH_SRC).convert("RGB")
    earth_src_size = list(earth_im.size)
    earth = save(earth_im.resize((2048, 1024), Image.Resampling.LANCZOS), "earth-visual-2k.jpg", 90)

    meta = {
        "schemaVersion": B.SCHEMA_VERSION,
        "purpose": "Appearance textures for the 3D views. Not used by any visibility or metric calculation.",
        "moonColor": {
            "files": [moon, moon_small],
            "grid": "simple cylindrical, centred on 0 deg longitude, row 0 north: identical to globe/moon-elevation.json (same UV mapping)",
            "conversion": "16-bit sRGB TIFF -> 8-bit sRGB (value / 257, rounded) -> JPEG q90, 4:4:4; 2048 version by Lanczos downsampling. No colour or contrast change.",
            "source": {
                "product": "NASA SVS CGI Moon Kit, 2025 colour map, lroc_color_16bit_srgb_4k.tif (from LRO LROC WAC mosaics)",
                "url": "https://svs.gsfc.nasa.gov/4720/",
                "file": MOON_URL,
                "sourceSha256": sha_file(MOON_SRC),
                "credit": "NASA's Scientific Visualization Studio; LRO LROC team (Arizona State University)",
            },
            "note": "A colour-enhanced albedo map without shadows, designed for rendering. Lighting must come from the true Sun direction.",
        },
        "earthColor": {
            "files": [earth],
            "conversion": f"PNG {earth_src_size[0]}x{earth_src_size[1]} -> Lanczos 2048x1024 -> JPEG q90, 4:4:4. No colour change.",
            "source": {
                "product": "NASA Blue Marble Next Generation, March 2004 monthly composite (world.topo.2004-03)",
                "url": "https://svs.gsfc.nasa.gov/12564/",
                "inputFile": "public/assets/earth-blue-marble-2004-03.png (read only, unchanged)",
                "inputSha256": sha_file(EARTH_SRC),
                "credit": "NASA Goddard Space Flight Center; Blue Marble data courtesy of Reto Stockli (NASA/GSFC)",
            },
            "note": "Historical appearance (March 2004). Not 2027 weather or cloud cover. Earth rotation in sky.json is the low-precision IAU_EARTH model, visual only.",
        },
        "generator": "scientific/build_visual_assets.py",
    }
    with open(os.path.join(OUT_DIR, "visual-assets.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    print(json.dumps([moon, moon_small, earth], indent=1))


if __name__ == "__main__":
    main()
