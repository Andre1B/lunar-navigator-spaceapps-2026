"""SPICE ephemerides for observers on the lunar surface (offline, NAIF kernels)."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import numpy as np
import spiceypy as sp

import lunar_geo as g

KERNEL_DIR = os.path.join(os.path.dirname(__file__), "cache", "kernels")
KERNELS = (
    ("naif0012.tls", "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls"),
    ("pck00011.tpc", "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc"),
    ("de440s.bsp", "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp"),
    ("moon_pa_de440_200625.bpc", "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc"),
    ("moon_de440_250416.tf", "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf"),
)
SUN_RADIUS_KM = 696000.0
EARTH_RADIUS_KM = 6378.137
ABCORR = "LT+S"

_loaded = False


def load_kernels():
    global _loaded
    if not _loaded:
        for name, _ in KERNELS:
            sp.furnsh(os.path.join(KERNEL_DIR, name))
        _loaded = True


def utc_grid(start_utc: str, end_utc: str, step_minutes: float):
    start = datetime.fromisoformat(start_utc.replace("Z", "+00:00"))
    end = datetime.fromisoformat(end_utc.replace("Z", "+00:00"))
    n = int((end - start).total_seconds() // (step_minutes * 60)) + 1
    return [start + timedelta(minutes=step_minutes * i) for i in range(n)]


def to_et(dt: datetime) -> float:
    return float(sp.str2et(dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f") + " UTC"))


def et_to_iso(et: float) -> str:
    return str(sp.et2utc(et, "ISOC", 0)) + "Z"


def observer_pos_km(lat_deg, lon_deg, height_above_sphere_m):
    u = g.latlon_to_unit(lat_deg, lon_deg)
    return u * (g.R_MOON_M + height_above_sphere_m) / 1000.0


def azel(target: str, ets, obs_pos_km):
    """Apparent (LT+S) range, azimuth (cw from north) and elevation of target
    seen from a MOON_ME surface point. Returns arrays (range_km, az_deg, el_deg)."""
    load_kernels()
    out = np.empty((len(ets), 3))
    for i, et in enumerate(ets):
        azlsta, _ = sp.azlcpo("ELLIPSOID", target, et, ABCORR, False, True,
                              obs_pos_km, "MOON", "MOON_ME")
        out[i] = azlsta[:3]
    rng = out[:, 0]
    az = np.mod(np.degrees(out[:, 1]), 360.0)
    el = np.degrees(out[:, 2])
    return rng, az, el


def disk_fraction(el_deg, horizon_deg, ang_radius_deg):
    """Visible fraction of a uniform disk cut horizontally at the horizon
    elevation (Barker et al. 2021 approximation, no limb darkening)."""
    d = np.clip((np.asarray(el_deg) - horizon_deg) / ang_radius_deg, -1.0, 1.0)
    return 1.0 - (np.arccos(d) - d * np.sqrt(1.0 - d * d)) / np.pi


def sky_vectors(ets):
    """Moon-centred J2000 apparent positions of Sun and Earth (km) and
    rotation quaternions J2000->MOON_ME and J2000->IAU_EARTH (SPICE w,x,y,z)."""
    load_kernels()
    sun, earth, qm, qe = [], [], [], []
    for et in ets:
        sun.append(sp.spkpos("SUN", et, "J2000", ABCORR, "MOON")[0])
        earth.append(sp.spkpos("EARTH", et, "J2000", ABCORR, "MOON")[0])
        qm.append(sp.m2q(sp.pxform("J2000", "MOON_ME", et)))
        qe.append(sp.m2q(sp.pxform("J2000", "IAU_EARTH", et)))
    return np.array(sun), np.array(earth), np.array(qm), np.array(qe)


def earth_occults_sun_from_moon(et) -> int:
    """SPICE occult code with the Moon centre as observer (flag only)."""
    load_kernels()
    return sp.occult("EARTH", "ELLIPSOID", "IAU_EARTH", "SUN", "ELLIPSOID", "IAU_SUN",
                     "LT", "MOON", et)
