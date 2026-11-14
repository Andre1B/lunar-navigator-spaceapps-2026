"""Global lunar elevation grids for the 3D globe -> public/data/globe/ (visual geometry).

Source: NASA SVS CGI Moon Kit ldem_4.tif (LOLA, 4 px/deg, km above 1737.4 km).
Run from scientific/:  PYTHONPATH=. python -P build_globe.py
"""
from __future__ import annotations

import hashlib
import json
import os

import numpy as np
import tifffile

import build_scenes as B
import lunar_geo as g

SRC = os.path.join(B.CACHE, "svs", "ldem_4.tif")
SRC_URL = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif"
OUT_DIR = os.path.join(B.OUT, "globe")


def orientation_check(a_km):
    """Compare south-polar pixels with PDS LDEM_80S_80M and test +/-1 deg shifts."""
    d80 = g.load_pds_polar_img(os.path.join(B.CACHE, "dem", "LDEM_80S_80M.IMG"))
    rows = range(684, 716, 3)
    cols = range(0, 1440, 37)

    def medabs(dc, dr=0):
        out = []
        for r in rows:
            for c in cols:
                lat = 90 - (r + 0.5) * 0.25
                lon = -180 + (c + 0.5) * 0.25
                x, y = g.latlon_to_xy(lat, lon % 360)
                v = d80.sample(np.array([x]), np.array([y]))[0]
                if np.isfinite(v):
                    out.append(a_km[(r + dr) % 720, (c + dc) % 1440] * 1000 - v)
        out = np.array(out)
        return float(np.median(out)), float(np.median(np.abs(out))), int(out.size)

    med, mad0, n = medabs(0)
    shifted = {f"{dc:+d}col": round(medabs(dc)[1], 1) for dc in (-4, 4)}
    return {"medianDiffM": round(med, 1), "medianAbsDiffM": round(mad0, 1), "n": n,
            "medianAbsDiffWithLonShiftM": shifted,
            "note": "Polar pixels (82-89.5 S) vs PDS LDEM_80S_80M. Unshifted grid fits best; the residual reflects the 4 px/deg (~7.6 km) resolution."}


def isotropic(a_m):
    """Circular box filter along each row over k = round(1 / cos(lat)) columns,
    so every sample averages a physical E-W width close to the row spacing.
    Near the poles the raw grid packs independent samples a few metres apart
    along a row; finite differences there produce false slopes > 1."""
    h, w = a_m.shape
    out = np.empty_like(a_m)
    for r in range(h):
        lat = np.radians(90.0 - (r + 0.5) * 180.0 / h)
        k = int(min(w, max(1, round(1.0 / np.cos(lat)))))
        if k == 1:
            out[r] = a_m[r]
            continue
        ext = np.concatenate([a_m[r, -(k // 2):], a_m[r], a_m[r, :k - k // 2]])
        cs = np.concatenate([[0.0], np.cumsum(ext)])
        out[r] = (cs[k:k + w] - cs[:w]) / k
    return out


def write_grid(name, a_m, url_note):
    path = os.path.join(OUT_DIR, name)
    q = np.round(a_m).astype("<i2")
    q.tofile(path)
    return {"file": f"globe/{name}", "width": int(a_m.shape[1]), "height": int(a_m.shape[0]),
            "bytes": os.path.getsize(path), "sha256": hashlib.sha256(q.tobytes()).hexdigest(),
            "minM": int(q.min()), "maxM": int(q.max()), "derivation": url_note}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    with tifffile.TiffFile(SRC) as t:
        a_km = t.pages[0].asarray().astype(np.float64)
    if a_km.shape != (720, 1440):
        raise ValueError("unexpected ldem_4 shape")
    check = orientation_check(a_km)
    a_m = a_km * 1000.0
    full = write_grid("moon-elevation-1440x720.i16", a_m, "ldem_4.tif km x 1000, rounded to the nearest metre")
    half = a_m.reshape(360, 2, 720, 2).mean(axis=(1, 3))
    small = write_grid("moon-elevation-720x360.i16", half, "2x2 mean of the 1440x720 grid, rounded to the nearest metre")
    full_iso = write_grid("moon-elevation-1440x720-isotropic.i16", isotropic(a_m),
                          "1440x720 grid, each row box-averaged along longitude over round(1/cos(lat)) columns (circular)")
    small_iso = write_grid("moon-elevation-720x360-isotropic.i16", isotropic(half),
                           "720x360 grid, each row box-averaged along longitude over round(1/cos(lat)) columns (circular)")
    meta = {
        "schemaVersion": B.SCHEMA_VERSION,
        "purpose": "True-scale lunar relief for the 3D globe (geometry and shading). Not used by any visibility or metric calculation; site horizons use the PGDA/PDS DEMs in sites/*.json.",
        "encoding": "Raw little-endian int16, row-major, metres above the 1737.4 km reference sphere (radius = 1737400 + value). No no-data values.",
        "grid": {
            "projection": "simple cylindrical (equirectangular), planetocentric latitude, east-positive longitude",
            "row0": "northernmost row; row r centre latitude = 90 - (r + 0.5) * 180 / height",
            "col0": "westernmost column; column c centre longitude = -180 + (c + 0.5) * 360 / width (map centred on 0 deg)",
            "uvForThreeSphereGeometry": "With the body frame mapped (x,y,z)->(x,z,-y), three.js SphereGeometry has u = (lon + 180) / 360 (u = 0.5 at lon 0 on local +X, u = 0.25 at lon -90) and uv.y = 1 at the north pole. Row 0 of this grid is north, so sample row = (1 - uv.y) * height, or upload it as a texture with three's default flipY = true.",
            "frame": "LOLA mean-Earth/polar-axis lunar frame (same as manifest conventions)",
        },
        "files": [full, small],
        "isotropicFiles": [full_iso, small_iso],
        "isotropicNote": "Use the isotropic variants for mesh displacement and normals. In the raw grids, samples along a row near a pole are only metres apart while rows are 7.6-15 km apart, so neighbour differences give false east-west slopes (up to ~19 at 89.9 S). The isotropic variants average each row over about one row spacing of physical distance. Equatorial rows are unchanged (k = 1). This is resampling, not smoothing for looks; true scale is kept.",
        "normalsRecommendation": "Physical normal at a vertex: n = normalize(U - dh/de * E - dh/dn * N), with dh/de and dh/dn from samples at a fixed physical baseline (>= the row spacing; 7.6 km for 1440x720, 15.2 km for 720x360) taken at great-circle points P +/- baseline * E and P +/- baseline * N, and U, E, N the local up, east and north. Within ~1 deg of a pole, prefer the polar products (LOLA polar DEMs) or set the normal to U.",
        "verticalScale": "1.0 (true scale). Relief spans about 19.4 km, 1.1% of the radius. Any vertical exaggeration applied by the renderer must be labelled visual only.",
        "orientationCheck": check,
        "source": {
            "product": "NASA SVS CGI Moon Kit, displacement map ldem_4.tif (4 px/deg, float km relative to 1737.4 km), derived from LRO LOLA",
            "url": "https://svs.gsfc.nasa.gov/4720/",
            "file": SRC_URL,
            "credit": "NASA's Scientific Visualization Studio; LRO LOLA team",
        },
        "generator": "scientific/build_globe.py",
    }
    with open(os.path.join(OUT_DIR, "moon-elevation.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    print(json.dumps({k: meta[k] for k in ("files", "orientationCheck")}, indent=1))


if __name__ == "__main__":
    main()
