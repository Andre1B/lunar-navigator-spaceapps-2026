"""Opaque spherical Earth eclipsing a uniform solar disk, with a terrain cut.

Angular circles in a Sun-centred azimuthal-equidistant tangent plane. This is
an explicitly approximate angular-disk model, not atmospheric transmission or
irradiance. The same horizontal terrain cut as the original horizon model is
applied jointly, avoiding multiplication of independent visible fractions.
"""
from __future__ import annotations

from functools import lru_cache
import numpy as np


@lru_cache(maxsize=4)
def gauss(order):
    return np.polynomial.legendre.leggauss(order)


def overlap_fraction(radius, occ_radius, distance):
    """Analytic circle intersection, divided by solar disk area."""
    r, R, d = float(radius), float(occ_radius), float(distance)
    if d >= r + R:
        return 0.0
    if d <= abs(R - r):
        return min(r, R) ** 2 / r ** 2
    a = np.arccos(np.clip((d*d+r*r-R*R)/(2*d*r), -1, 1))
    b = np.arccos(np.clip((d*d+R*R-r*r)/(2*d*R), -1, 1))
    q = (-d+r+R)*(d+r-R)*(d-r+R)*(d+r+R)
    return float((r*r*a + R*R*b - 0.5*np.sqrt(max(q, 0))) / (np.pi*r*r))


def visible_fraction(radius, occ_radius, cx, cy, horizon_y, order=128):
    """Area of solar circle above y=horizon_y and outside the Earth circle.

    Integrate horizontal chord intersections. Break at circle intersections,
    extrema and terrain cut; Gauss-Legendre then has no unsplit interior kinks.
    Exact zero/full/unobscured cases avoid threshold noise in rise/set events.
    """
    r, R = float(radius), float(occ_radius)
    d = float(np.hypot(cx, cy))
    h = float(horizon_y)
    if h >= r or d + r <= R:
        return 0.0
    if h <= -r:
        return max(0.0, 1.0-overlap_fraction(r, R, d))
    # Full coverage of the *terrain-visible cap* can occur before Earth covers
    # the whole solar disk. Decide this geometrically, not by subtracting two
    # nearly equal numerical areas (which could leave spurious direct sunlight).
    farthest_y = -r*cy/d if d > 0 else r
    if farthest_y >= h:
        cap_max_distance = d+r
    else:
        cap_max_distance = np.hypot(abs(cx)+np.sqrt(max(0, r*r-h*h)), h-cy)
    if cap_max_distance <= R:
        return 0.0
    z = np.clip(-h/r, -1, 1)
    terrain = 1-(np.arccos(z)-z*np.sqrt(1-z*z))/np.pi
    if d >= r+R:
        return float(terrain)
    # Exact circle containment: only the Earth disk portion above the cut is blocked.
    if d + R <= r:
        q = np.clip((cy-h)/R, -1, 1)
        covered = R*R*(np.pi-np.arccos(q)+q*np.sqrt(1-q*q))
        return float(np.clip(terrain-covered/(np.pi*r*r), 0, terrain))
    lo, hi = max(h, -r, cy-R), min(r, cy+R)
    if lo >= hi:
        return float(terrain)
    breaks = [lo, hi]
    if abs(r-R) < d < r+R:
        a = (r*r-R*R+d*d)/(2*d)
        b = np.sqrt(max(0, r*r-a*a))
        breaks += [a*cy/d-b*cx/d, a*cy/d+b*cx/d]
    breaks = sorted(set(float(y) for y in breaks if lo <= y <= hi))
    nodes, weights = gauss(order)
    blocked = 0.0
    for a, b in zip(breaks, breaks[1:]):
        ys = (b-a)*0.5*nodes+(a+b)*0.5
        sx = np.sqrt(np.maximum(0, r*r-ys*ys))
        ex = np.sqrt(np.maximum(0, R*R-(ys-cy)**2))
        chord = np.maximum(0, np.minimum(sx, cx+ex)-np.maximum(-sx, cx-ex))
        blocked += (b-a)*0.5*float(weights@chord)
    return float(np.clip(terrain-blocked/(np.pi*r*r), 0, terrain))


def geometry(sun, earth):
    """Earth angular centre (x right, y up) relative to Sun, in degrees."""
    sa, se, ea, ee = (np.radians(x) for x in (sun['az'], sun['el'], earth['az'], earth['el']))
    # Local axes north/east/up; tangent x increases azimuth, y elevation.
    su = np.stack([np.cos(se)*np.cos(sa), np.cos(se)*np.sin(sa), np.sin(se)], axis=-1)
    eu = np.stack([np.cos(ee)*np.cos(ea), np.cos(ee)*np.sin(ea), np.sin(ee)], axis=-1)
    right = np.stack([-np.sin(sa), np.cos(sa), np.zeros_like(sa)], axis=-1)
    up = np.stack([-np.sin(se)*np.cos(sa), -np.sin(se)*np.sin(sa), np.cos(se)], axis=-1)
    x, y = np.sum(eu*right, axis=-1), np.sum(eu*up, axis=-1)
    rho = np.hypot(x, y)
    sep = np.arctan2(rho, np.sum(su*eu, axis=-1))
    scale = np.divide(np.degrees(sep), rho, out=np.ones_like(rho), where=rho > 1e-15)
    return x*scale, y*scale, np.degrees(sep)


def apply(series, horizon):
    sun, earth = series['SUN'], series['EARTH']
    x, y, sep = geometry(sun, earth)
    margin = sep-sun['ang']-earth['ang']
    sun['terrainFrac'] = sun['frac'].copy()
    sun['unobscured'] = np.ones_like(sun['frac'])
    sun['eclipseMargin'] = margin
    for i in np.flatnonzero(margin < 0):
        sun['unobscured'][i] = 1-overlap_fraction(sun['ang'][i], earth['ang'][i], sep[i])
        sun['frac'][i] = visible_fraction(sun['ang'][i], earth['ang'][i], x[i], y[i],
                                           horizon[i]-sun['el'][i])
    return series
