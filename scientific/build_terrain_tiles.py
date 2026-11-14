"""Local terrain tiles around each site -> public/data/terrain/ (visual geometry).

20 km x 20 km, 40 m cells (500 x 500), int16 metres above the 1737.4 km sphere.
Each 40 m cell is the mean of 8 x 8 bilinear samples of the PGDA 5 m DEM; cells
outside that DEM fall back to PDS LDEM_80S_80M (bilinear at the cell centre).
Run from scientific/:  PYTHONPATH=. python -P build_terrain_tiles.py
"""
from __future__ import annotations

import hashlib
import json
import os

import numpy as np

import build_scenes as B
import lunar_geo as g

SIZE_M = 20000.0
CELL_M = 40.0
SUB = 8  # 8 x 8 sub-samples per cell = 5 m spacing
OUT_DIR = os.path.join(B.OUT, "terrain")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    mid = g.load_pds_polar_img(os.path.join(B.CACHE, "dem", "LDEM_80S_80M.IMG"))
    n = int(SIZE_M / CELL_M)
    entries = []
    for site in B.SITES:
        near = g.load_pgda_geotiff(os.path.join(B.CACHE, "dem", site["pgda"],
                                                f"{site['pgda']}_final_adj_5mpp_surf.tif"))
        xs, ys = site["xy"]
        x0 = xs - SIZE_M / 2.0
        y0 = ys + SIZE_M / 2.0
        h = np.empty((n, n))
        from_pgda = np.zeros((n, n), dtype=bool)
        sub = (np.arange(SUB) + 0.5) * (CELL_M / SUB)
        for r in range(n):
            cx = x0 + np.arange(n) * CELL_M
            cy = y0 - r * CELL_M
            sx = (cx[:, None] + sub[None, :])[:, None, :].repeat(SUB, axis=1)
            sy = np.broadcast_to((cy - sub)[None, :, None], (n, SUB, SUB))
            v = near.sample(sx.ravel(), sy.ravel()).reshape(n, SUB * SUB)
            ok = np.all(np.isfinite(v), axis=1)
            row = np.where(ok, np.nanmean(np.where(np.isfinite(v), v, 0.0), axis=1), np.nan)
            centre_x = cx + CELL_M / 2.0
            fb = mid.sample(centre_x, np.full(n, cy - CELL_M / 2.0))
            h[r] = np.where(ok, row, fb)
            from_pgda[r] = ok
        if not np.all(np.isfinite(h)):
            raise ValueError(f"gaps in tile for {site['id']}")
        q = np.round(h).astype("<i2")
        name = f"{site['id']}-20km-40m.i16"
        q.tofile(os.path.join(OUT_DIR, name))
        cr = (n - 1) / 2.0
        entries.append({
            "siteId": site["id"],
            "file": f"terrain/{name}",
            "width": n, "height": n, "cellSizeM": CELL_M,
            "boundsPolarStereoM": {"xMin": x0, "xMax": x0 + SIZE_M, "yMin": y0 - SIZE_M, "yMax": y0},
            "siteXYM": [xs, ys],
            "siteCellRowCol": [cr, cr],
            "minM": int(q.min()), "maxM": int(q.max()),
            "siteTerrainHeightM": round(float(near.sample(np.array([xs]), np.array([ys]))[0]), 1),
            "fractionFromPgda5m": round(float(from_pgda.mean()), 4),
            "sha256": hashlib.sha256(q.tobytes()).hexdigest(),
        })
        print(site["id"], entries[-1]["minM"], entries[-1]["maxM"], entries[-1]["fractionFromPgda5m"])
    meta = {
        "schemaVersion": B.SCHEMA_VERSION,
        "purpose": "Local 3D terrain for an oblique overview of each site. Visual geometry only: horizons and metrics come from sites/*.json (5 m near field plus 80 m and 240 m far field), not from these tiles.",
        "encoding": "Raw little-endian int16, row-major, metres above the 1737.4 km reference sphere (radius = 1737400 + value). No no-data values.",
        "grid": {
            "projection": "south polar stereographic on the 1737.4 km sphere, true scale at the pole; X/Y in metres; longitude 0 toward +Y, 90 E toward +X (same as manifest sites[].polarStereoXYM)",
            "cellCentre": "x = xMin + (c + 0.5) * cellSizeM ; y = yMax - (r + 0.5) * cellSizeM (row 0 is the +Y edge, column 0 the -X edge)",
            "registration": "cell-centred (PixelIsArea); the site lies on the shared corner of the four central cells",
            "aggregation": "each cell = mean of 8 x 8 bilinear samples (5 m spacing) of the PGDA 5 m DEM; cells not fully covered by it use PDS LDEM_80S_80M bilinear at the cell centre (see fractionFromPgda5m)",
            "frame": "MOON_ME of DE421 (same as all DEMs here)",
        },
        "helpers": {
            "toLatLon": "rho = hypot(x, y); lat = -90 + 2 * atan(rho / (2 * 1737400)) [deg]; lon = atan2(x, y) [deg east]",
            "toBodyFixedM": "P = (1737400 + h) * (cos lat cos lon, cos lat sin lon, sin lat) in MOON_ME; use exact positions, not a flat plane (the drop is about 29 m at 10 km from the site)",
            "toSiteENU": "zenith U = unit(lat0, lon0); east E = normalize((0,0,1) x U); north N = U x E; local = ((P - O)·E, (P - O)·N, (P - O)·U) with O = (1737400 + h0) * U",
            "mapAxesAtSite": "at the site, map +rho (direction (sin lon0, cos lon0) in X/Y) is local north and (cos lon0, -sin lon0) is local east; the stereographic scale factor here is 1.000 to within 0.2%",
            "normals": "build normals from the exact 3D positions of neighbouring cells (cross product of central differences), not from the int16 values alone",
            "threeMapping": "same P mapping as sky.json and the globe: three (x, y, z) = (X_body, Z_body, -Y_body)",
        },
        "verticalScale": "1.0 (true scale). Any exaggeration must be labelled visual only.",
        "tiles": entries,
        "source": {
            "near": "PGDA High-Resolution LOLA Topography for Lunar South Pole Sites, 5 m/pix (Barker et al. 2021), https://pgda.gsfc.nasa.gov/products/78",
            "fallback": "LOLA PDS LDEM_80S_80M, https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/",
        },
        "generator": "scientific/build_terrain_tiles.py",
    }
    with open(os.path.join(OUT_DIR, "terrain.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(meta, f, indent=1)


if __name__ == "__main__":
    main()
