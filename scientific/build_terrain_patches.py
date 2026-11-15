"""Near-field terrain patches around each site -> public/data/terrain/ (visual geometry).

2 km x 2 km, 5 m cells (400 x 400), centred on the site, sampled bilinearly at the
cell centres of the PGDA 5 m DEM (the same product the 40 m tiles average). Stored
as int16 DECIMETRES relative to the site's terrain height, so 5 m relief is not
lost to 1 m quantisation. Only for the Surface sky foreground: horizons, metrics
and occlusion come from sites/*.json, never from these patches.
Run from scientific/:  PYTHONPATH=. python -P build_terrain_patches.py
"""
from __future__ import annotations

import hashlib
import json
import os

import numpy as np

import build_scenes as B
import lunar_geo as g

SIZE_M = 2000.0
CELL_M = 5.0
OUT_DIR = os.path.join(B.OUT, "terrain")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    n = int(SIZE_M / CELL_M)
    entries = []
    for site in B.SITES:
        near = g.load_pgda_geotiff(os.path.join(B.CACHE, "dem", site["pgda"],
                                                f"{site['pgda']}_final_adj_5mpp_surf.tif"))
        xs, ys = site["xy"]
        x0 = xs - SIZE_M / 2.0
        y0 = ys + SIZE_M / 2.0
        cx = x0 + (np.arange(n) + 0.5) * CELL_M
        cy = y0 - (np.arange(n) + 0.5) * CELL_M
        X, Y = np.meshgrid(cx, cy)
        h = near.sample(X.ravel(), Y.ravel()).reshape(n, n)
        if not np.all(np.isfinite(h)):
            raise ValueError(f"{site['id']}: the 2 km patch leaves the PGDA 5 m DEM")
        h0 = float(near.sample(np.array([xs]), np.array([ys]))[0])
        dm = np.round((h - h0) * 10.0)
        if dm.min() < -32768 or dm.max() > 32767:
            raise ValueError(f"{site['id']}: relief exceeds the int16 decimetre range")
        q = dm.astype("<i2")
        name = f"{site['id']}-2km-5m-dm.i16"
        q.tofile(os.path.join(OUT_DIR, name))
        entries.append({
            "siteId": site["id"],
            "file": f"terrain/{name}",
            "width": n, "height": n, "cellSizeM": CELL_M,
            "boundsPolarStereoM": {"xMin": x0, "xMax": x0 + SIZE_M, "yMin": y0 - SIZE_M, "yMax": y0},
            "siteXYM": [xs, ys],
            "baseHeightM": round(h0, 3),
            "minM": round(h0 + q.min() / 10.0, 1), "maxM": round(h0 + q.max() / 10.0, 1),
            "sha256": hashlib.sha256(q.tobytes()).hexdigest(),
        })
        print(site["id"], entries[-1]["minM"], entries[-1]["maxM"])
    meta = {
        "schemaVersion": B.SCHEMA_VERSION,
        "purpose": "Near-field foreground for the Surface sky view only. Visual geometry: horizons, occlusion and metrics come from sites/*.json, not from these patches. Not a claim of 5 m physical accuracy or photometry.",
        "encoding": "Raw little-endian int16, row-major, DECIMETRES relative to baseHeightM; height above the 1737.4 km sphere = baseHeightM + value / 10.",
        "grid": {
            "projection": "south polar stereographic on the 1737.4 km sphere, true scale at the pole; same X/Y convention as terrain/terrain.json",
            "cellCentre": "x = xMin + (c + 0.5) * cellSizeM ; y = yMax - (r + 0.5) * cellSizeM",
            "sampling": "bilinear sample of the PGDA 5 m DEM at each cell centre (no averaging)",
            "frame": "MOON_ME of DE421 (same as all DEMs here)",
        },
        "patches": entries,
        "source": "PGDA High-Resolution LOLA Topography for Lunar South Pole Sites, 5 m/pix (Barker et al. 2021), https://pgda.gsfc.nasa.gov/products/78",
        "generator": "scientific/build_terrain_patches.py",
    }
    with open(os.path.join(OUT_DIR, "near.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1)


if __name__ == "__main__":
    main()
