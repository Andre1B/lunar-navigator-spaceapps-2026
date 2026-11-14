"""NASA Deep Star Maps 2020 (celestial) -> public/data/starmap/ (visual background).

Source: SVS 4851 starmap_2020_4k.exr (half-float linear RGB, 0..1, ICRF/J2000
plate carree centred on RA 0h, RA increasing to the left).
Converted with the standard linear->sRGB transfer, no exposure change.
Run from scientific/:  PYTHONPATH=. python -P build_starmap.py
Needs OpenEXR (read) and Pillow (JPEG write); neither is used by the core pipeline.
"""
from __future__ import annotations

import hashlib
import json
import os

import numpy as np
import OpenEXR
from PIL import Image

import build_scenes as B

SRC = os.path.join(B.CACHE, "svs", "starmap_2020_4k.exr")
SRC_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr"
OUT_DIR = os.path.join(B.OUT, "starmap")


def to_srgb(lin):
    lin = np.clip(lin, 0.0, 1.0)
    return np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with OpenEXR.File(SRC) as f:
        rgb = f.channels()["RGB"].pixels.astype(np.float32)
    img = (to_srgb(rgb) * 255.0 + 0.5).astype(np.uint8)
    files = []
    for w, q in ((4096, 88), (2048, 88)):
        im = Image.fromarray(img)
        if w != img.shape[1]:
            im = im.resize((w, w // 2), Image.Resampling.LANCZOS)
        name = f"starmap-2020-celestial-{w}x{w // 2}.jpg"
        path = os.path.join(OUT_DIR, name)
        im.save(path, quality=q, optimize=True, progressive=True)
        with open(path, "rb") as fh:
            files.append({"file": f"starmap/{name}", "width": w, "height": w // 2,
                          "bytes": os.path.getsize(path), "sha256": hashlib.sha256(fh.read()).hexdigest()})
    meta = {
        "schemaVersion": B.SCHEMA_VERSION,
        "purpose": "Background sky for the 3D views. Star positions are real (catalogue based); brightness and colour are an illustrative rendering, not a photometric or exposure-correct view from the lunar surface.",
        "files": files,
        "grid": {
            "projection": "plate carree (equirectangular) in ICRF/J2000 right ascension and declination",
            "columns": "column c centre RA = (180 - (c + 0.5) * 360 / width) mod 360 deg  (RA 0h at the centre, increasing to the LEFT, as seen from inside the sphere)",
            "rows": "row r centre Dec = 90 - (r + 0.5) * 180 / height deg",
            "threeMapping": "For a J2000 direction d, RA = atan2(d.y, d.x), Dec = asin(d.z); in the scene's P mapping (x, y, z) -> (x, z, -y). On a three SphereGeometry, uv.u_geom = (RA + 180) / 360, so the texture needs u_tex = 1 - u_geom: set texture.wrapS = RepeatWrapping, repeat.x = -1, offset.x = 1 (or scale the sky sphere by -1 in X). Use side = BackSide and keep the sky sphere unrotated, since J2000 is the scene's world frame.",
            "verify": "Orion's belt (RA ~5.6 h, Dec ~-1 deg) and the Southern Cross (RA ~12.4 h, Dec ~-60 deg) should appear there; the south celestial pole is near the lunar south pole's sky only approximately (the lunar spin axis is ~1.5 deg from the ecliptic pole, not the celestial pole).",
        },
        "conversion": "EXR half-float linear RGB (values 0-1) -> sRGB transfer function -> 8-bit JPEG (quality 88); 2048 version by Lanczos downsampling. No exposure or colour change.",
        "limitations": [
            "Illustrative brightness: the map is designed for animation, not photometry. Do not infer what an observer or camera on the Moon would see next to the Sun.",
            "Star positions are J2000 catalogue positions; proper motion to 2027 and aberration are not applied (well below display resolution).",
        ],
        "source": {
            "product": "NASA SVS Deep Star Maps 2020, celestial coordinates, starmap_2020_4k.exr",
            "url": "https://svs.gsfc.nasa.gov/4851/",
            "file": SRC_URL,
            "credit": "NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC.",
        },
        "generator": "scientific/build_starmap.py",
    }
    with open(os.path.join(OUT_DIR, "starmap.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1)
    print(json.dumps(files, indent=1))


if __name__ == "__main__":
    main()
