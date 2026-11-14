"""Terrain horizon profiles from nested LOLA DEMs.

Method follows Mazarico et al. (2011) / Barker et al. (2021): elevation of the
horizon along 720 sight lines (0.5 deg azimuth), nested DEMs (5 m near field,
80 m mid field, 240 m far field), exact Cartesian geometry on the 1737.4 km
sphere (no d^2/2R approximation). Sight lines are great circles.
"""
from __future__ import annotations

import numpy as np

import lunar_geo as g

AZ_STEP_DEG = 0.5
AZIMUTHS_DEG = np.arange(0.0, 360.0, AZ_STEP_DEG)

# (dem key, start m, end m, step m). Ranges follow Barker et al. 2021 Sec. 5.
DEFAULT_LAYERS = (
    ("near", 5.0, 5000.0, 5.0),
    ("mid", 5000.0, 100000.0, 40.0),
    ("far", 100000.0, 1200000.0, 240.0),
)


def horizon_profile(lat_deg, lon_deg, dems, observer_heights_m, layers=DEFAULT_LAYERS,
                    max_range_m=None, terrain_height_m=None):
    """Return dict with terrain height at the site and, per observer height,
    the horizon elevation (deg) for each azimuth in AZIMUTHS_DEG.

    dems: mapping layer key -> Dem. Samples outside a layer's DEM are skipped;
    'reach_m' reports the farthest valid sample per azimuth.
    """
    x0, y0 = g.latlon_to_xy(lat_deg, lon_deg)
    if terrain_height_m is None:
        terrain_height_m = float(dems["near"].sample(np.array([x0]), np.array([y0]))[0])
    if not np.isfinite(terrain_height_m):
        raise ValueError("no terrain height at site")
    u0 = g.latlon_to_unit(lat_deg, lon_deg)
    az = np.radians(AZIMUTHS_DEG)[:, None]
    heights = list(observer_heights_m)
    best = {h: np.full(AZIMUTHS_DEG.size, -90.0) for h in heights}
    reach = np.zeros(AZIMUTHS_DEG.size)
    for key, start, end, step in layers:
        if max_range_m is not None:
            end = min(end, max_range_m)
        if start >= end:
            continue
        dist = np.arange(start, end, step)[None, :]
        lat2, lon2 = g.destination(lat_deg, lon_deg, az, dist)
        x, y = g.latlon_to_xy(lat2, lon2)
        h = dems[key].sample(x.ravel(), y.ravel()).reshape(x.shape)
        valid = np.isfinite(h)
        if not np.any(valid):
            continue
        reach = np.maximum(reach, np.where(valid, dist, 0.0).max(axis=1))
        u = g.latlon_to_unit(lat2, lon2)  # (naz, nd, 3)
        rad_p = g.R_MOON_M + np.where(valid, h, -1e9)
        p = u * rad_p[..., None]
        for hobs in heights:
            o = u0 * (g.R_MOON_M + terrain_height_m + hobs)
            v = p - o
            sin_el = (v @ u0) / np.linalg.norm(v, axis=-1)
            el = np.degrees(np.arcsin(np.clip(sin_el, -1.0, 1.0)))
            el = np.where(valid, el, -90.0)
            best[hobs] = np.maximum(best[hobs], el.max(axis=1))
    return {
        "terrain_height_m": terrain_height_m,
        "elevation_deg": best,
        "reach_m": reach,
    }


def interp_horizon(profile_deg, az_deg):
    """Linear interpolation of a 0.5-deg horizon profile at arbitrary azimuths."""
    pos = np.mod(np.asarray(az_deg), 360.0) / AZ_STEP_DEG
    i0 = np.floor(pos).astype(int) % AZIMUTHS_DEG.size
    i1 = (i0 + 1) % AZIMUTHS_DEG.size
    f = pos - np.floor(pos)
    return profile_deg[i0] * (1 - f) + profile_deg[i1] * f
