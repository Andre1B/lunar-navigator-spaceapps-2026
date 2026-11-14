"""Lunar south-polar geometry and LOLA DEM access.

Conventions (see README.md):
- Reference sphere R = 1737.4 km (LOLA / PGDA products, Horizons, PCK).
- Polar stereographic X/Y in metres, south pole at origin, longitude 0 toward +Y,
  90 E toward +X (PDS DSMAP_POLAR.CAT; PGDA README "south polar stereographic").
- Heights are metres above the 1737.4 km sphere.
- Body-fixed frame: MOON_ME of DE421 (DEM products) == SPICE MOON_ME alias in
  moon_de440_250416.tf (MOON_ME_DE440_ME421).
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass

import numpy as np

R_MOON_M = 1737400.0


# ---------------------------------------------------------------- projection
def latlon_to_xy(lat_deg, lon_deg):
    """South polar stereographic (true scale at pole, sphere R)."""
    lat = np.radians(lat_deg)
    lon = np.radians(lon_deg)
    rho = 2.0 * R_MOON_M * np.tan((np.pi / 2.0 + lat) / 2.0)
    return rho * np.sin(lon), rho * np.cos(lon)


def xy_to_latlon(x, y):
    rho = np.hypot(x, y)
    lat = -np.pi / 2.0 + 2.0 * np.arctan(rho / (2.0 * R_MOON_M))
    lon = np.arctan2(x, y)
    return np.degrees(lat), np.mod(np.degrees(lon), 360.0)


def latlon_to_unit(lat_deg, lon_deg):
    lat = np.radians(lat_deg)
    lon = np.radians(lon_deg)
    cl = np.cos(lat)
    return np.stack([cl * np.cos(lon), cl * np.sin(lon), np.sin(lat)], axis=-1)


def destination(lat_deg, lon_deg, az_rad, dist_m):
    """Great-circle destination on the sphere. az clockwise from north."""
    lat1 = np.radians(lat_deg)
    lon1 = np.radians(lon_deg)
    delta = dist_m / R_MOON_M
    sin_lat2 = np.sin(lat1) * np.cos(delta) + np.cos(lat1) * np.sin(delta) * np.cos(az_rad)
    lat2 = np.arcsin(np.clip(sin_lat2, -1.0, 1.0))
    lon2 = lon1 + np.arctan2(
        np.sin(az_rad) * np.sin(delta) * np.cos(lat1),
        np.cos(delta) - np.sin(lat1) * sin_lat2,
    )
    return np.degrees(lat2), np.degrees(lon2)


# ---------------------------------------------------------------- DEMs
@dataclass
class Dem:
    """Regular grid in polar stereographic metres.

    Pixel centre of (row, col) is (x0 + col*scale, y0 - row*scale).
    """
    name: str
    data: np.ndarray  # float32 metres above sphere, NaN = no data
    x0: float
    y0: float
    scale: float

    def sample(self, x, y):
        """Bilinear sample; NaN outside the grid or on NaN neighbours."""
        c = (np.asarray(x) - self.x0) / self.scale
        r = (self.y0 - np.asarray(y)) / self.scale
        nr, nc = self.data.shape
        ok = (c >= 0) & (r >= 0) & (c <= nc - 1) & (r <= nr - 1)
        out = np.full(np.shape(c), np.nan, dtype=np.float64)
        if not np.any(ok):
            return out
        cc = c[ok]
        rr = r[ok]
        c0 = np.minimum(np.floor(cc).astype(np.int64), nc - 2)
        r0 = np.minimum(np.floor(rr).astype(np.int64), nr - 2)
        fc = cc - c0
        fr = rr - r0
        d = self.data
        v = (d[r0, c0] * (1 - fc) * (1 - fr) + d[r0, c0 + 1] * fc * (1 - fr)
             + d[r0 + 1, c0] * (1 - fc) * fr + d[r0 + 1, c0 + 1] * fc * fr)
        out[ok] = v
        return out

    def extent(self):
        nr, nc = self.data.shape
        return (self.x0, self.x0 + (nc - 1) * self.scale,
                self.y0 - (nr - 1) * self.scale, self.y0)


def _lbl_value(text, key):
    m = re.search(rf"^\s*{key}\s*=\s*([^\n<]+)", text, re.MULTILINE)
    if not m:
        raise KeyError(key)
    return m.group(1).strip().strip('"')


def load_pds_polar_img(img_path: str) -> Dem:
    """LOLA PDS polar IMG (LSB int16). Uses the DSMAP_POLAR.CAT inverse
    equations: X = (I - c)*s, Y = -(J - c)*s with 0-based offset c from the
    LINE/SAMPLE_PROJECTION_OFFSET keywords."""
    lbl_path = os.path.splitext(img_path)[0] + ".LBL"
    with open(lbl_path, "r", encoding="latin-1") as f:
        lbl = f.read()
    n_lines = int(_lbl_value(lbl, "LINES"))
    n_samp = int(_lbl_value(lbl, "LINE_SAMPLES"))
    scale = float(_lbl_value(lbl, "MAP_SCALE"))
    scaling = float(_lbl_value(lbl, "SCALING_FACTOR"))
    line_off = float(_lbl_value(lbl, "LINE_PROJECTION_OFFSET"))
    samp_off = float(_lbl_value(lbl, "SAMPLE_PROJECTION_OFFSET"))
    if _lbl_value(lbl, "SAMPLE_TYPE") != "LSB_INTEGER":
        raise ValueError("unexpected sample type")
    raw = np.fromfile(img_path, dtype="<i2", count=n_lines * n_samp).reshape(n_lines, n_samp)
    data = raw.astype(np.float32) * np.float32(scaling)
    return Dem(os.path.basename(img_path), data,
               x0=-samp_off * scale, y0=line_off * scale, scale=scale)


def load_pds_polar_map(img_path: str):
    """Generic PDS polar map (e.g. AVGVISIB, LPSR) returning (Dem, scaled values)."""
    lbl_path = os.path.splitext(img_path)[0] + ".LBL"
    with open(lbl_path, "r", encoding="latin-1") as f:
        lbl = f.read()
    n = int(_lbl_value(lbl, "LINES"))
    scale = float(_lbl_value(lbl, "MAP_SCALE"))
    k = float(_lbl_value(lbl, "SCALING_FACTOR"))
    off = float(_lbl_value(lbl, "OFFSET"))
    line_off = float(_lbl_value(lbl, "LINE_PROJECTION_OFFSET"))
    samp_off = float(_lbl_value(lbl, "SAMPLE_PROJECTION_OFFSET"))
    raw = np.fromfile(img_path, dtype="<i2", count=n * n).reshape(n, n)
    data = (raw.astype(np.float64) * k + off).astype(np.float32)
    return Dem(os.path.basename(img_path), data,
               x0=-samp_off * scale, y0=line_off * scale, scale=scale)


def load_pgda_geotiff(path: str) -> Dem:
    """PGDA 5 m/pix GeoTIFF (float32, NaN no-data). Tiepoint is the outer
    corner of the first pixel (GTRasterTypeGeoKey = PixelIsArea), consistent
    with the README's GMT pixel registration."""
    import tifffile

    with tifffile.TiffFile(path) as t:
        page = t.pages[0]
        tags = {tag.name: tag.value for tag in page.tags.values()}
        data = page.asarray().astype(np.float32)
    sx, sy, _ = tags["ModelPixelScaleTag"]
    tp = tags["ModelTiepointTag"]
    if abs(sx - sy) > 1e-9 or tp[0] != 0 or tp[1] != 0:
        raise ValueError("unexpected georeferencing")
    return Dem(os.path.basename(path), data,
               x0=tp[3] + sx / 2.0, y0=tp[4] - sy / 2.0, scale=sx)
