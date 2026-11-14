"""Illustrative Earth cloud and ocean-specular layers -> public/data/globe/ (appearance only).

Source: Solar System Scope textures (CC BY 4.0), 2k_earth_clouds.jpg and
2k_earth_specular_map.tif. Clouds are a fixed illustrative pattern, not
weather for any date. The NASA Blue Marble ground textures are kept as is.
Run from scientific/:  PYTHONPATH=. python -P build_earth_layers.py   (needs Pillow, tifffile)
"""
from __future__ import annotations

import hashlib
import json
import os

import numpy as np
import tifffile
from PIL import Image

import build_scenes as B

SSS = os.path.join(B.CACHE, "sss")
OUT_DIR = os.path.join(B.OUT, "globe")
BASE = "https://extension.solarsystemscope.com/textures/download/"
GROUND = os.path.join(B.OUT, "globe", "earth-visual-2k.jpg")


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def grey(a):
    a = np.asarray(a, dtype=np.float64)
    if a.ndim == 3:
        a = a[..., :3].mean(axis=2)
    return a


def orientation_check(spec):
    """Correlate the specular (water) mask with dark-blue ocean pixels of the
    NASA Blue Marble ground texture at several longitude shifts."""
    g = np.asarray(Image.open(GROUND).convert("RGB"), dtype=np.float64)
    ocean = ((g[..., 2] > g[..., 0] + 10) & (g[..., 0] < 60)).astype(float)
    water = (spec > spec.mean()).astype(float)
    out = {}
    for shift in (0, 512, 1024, -512):
        w = np.roll(water, shift, axis=1)
        out[str(shift)] = round(float(np.corrcoef(ocean.ravel(), w.ravel())[0, 1]), 3)
    return out


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    clouds_src = os.path.join(SSS, "2k_earth_clouds.jpg")
    spec_src = os.path.join(SSS, "2k_earth_specular_map.tif")
    clouds = grey(Image.open(clouds_src).convert("RGB"))
    spec = grey(tifffile.imread(spec_src))
    if spec.max() > 255:
        spec = spec / 257.0
    if clouds.shape != (1024, 2048) or spec.shape != (1024, 2048):
        raise ValueError("unexpected texture size")
    files = {}
    for key, arr, name in (("clouds", clouds, "earth-clouds-illustrative-2k.jpg"),
                           ("specular", spec, "earth-ocean-specular-2k.jpg")):
        path = os.path.join(OUT_DIR, name)
        Image.fromarray(np.clip(np.round(arr), 0, 255).astype(np.uint8), "L").save(
            path, quality=88, optimize=True, progressive=True)
        files[key] = {"file": f"globe/{name}", "width": 2048, "height": 1024,
                      "bytes": os.path.getsize(path), "sha256": sha(path)}
    check = orientation_check(spec)
    meta = {
        "schemaVersion": B.SCHEMA_VERSION,
        "purpose": "Illustrative Earth layers for appearance only: a cloud alpha/greyscale layer and an ocean specular (water) mask. Not used by any calculation.",
        "clouds": {
            **files["clouds"],
            "meaning": "Fixed illustrative cloud pattern (greyscale, 0 = clear, 255 = opaque cloud). NOT weather or cloud cover for 2027 or any specific date.",
            "source": {"file": BASE + "2k_earth_clouds.jpg", "sourceSha256": sha(clouds_src)},
            "conversion": "RGB JPEG -> mean of channels -> 8-bit greyscale JPEG q88. No other change.",
        },
        "specular": {
            **files["specular"],
            "meaning": "Water mask for ocean specular reflection (bright = water). Derived from imagery by Solar System Scope; may differ from the Blue Marble coastline in detail.",
            "source": {"file": BASE + "2k_earth_specular_map.tif", "sourceSha256": sha(spec_src)},
            "conversion": "TIFF (deflate, RGB) -> mean of channels -> 8-bit greyscale JPEG q88. No other change.",
        },
        "grid": "simple cylindrical, 2048x1024, centred on 0 deg longitude, row 0 north: same UV as earth-visual-2k/4k.jpg",
        "orientationCheck": {
            "correlationWithBlueMarbleOceanByLongitudeShiftPx": check,
            "note": "Correlation of the specular water mask with dark-blue ocean pixels of the NASA Blue Marble ground texture; it should peak at shift 0.",
        },
        "license": {
            "name": "CC BY 4.0",
            "url": "https://creativecommons.org/licenses/by/4.0/",
            "attribution": "Textures: Solar System Scope (https://www.solarsystemscope.com/), CC BY 4.0, based on NASA imagery; converted to greyscale JPEG for this project.",
            "sourcePage": "https://extension.solarsystemscope.com/textures/",
            "sourceNotes": "Per the source page: based on NASA elevation and imagery data, colours tuned and slightly saturated, gaps may be filled with fictional terrain.",
        },
        "groundNote": "The ground colour stays NASA Blue Marble (globe/earth-visual-*.jpg). The Solar System Scope colour map is not used.",
        "generator": "scientific/build_earth_layers.py",
    }
    with open(os.path.join(OUT_DIR, "earth-layers.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1)
    print(json.dumps({"files": files, "check": check}, indent=1))


if __name__ == "__main__":
    main()
