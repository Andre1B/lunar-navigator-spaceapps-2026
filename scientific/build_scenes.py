"""Build public/data/*.json for Lunar Landing Site Navigator (offline).

Run from scientific/:  PYTHONPATH=. python -P build_scenes.py
Inputs are cached under scientific/cache/ (not versioned; see fetch_data.sh).
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone

import numpy as np

import lunar_ephem as E
import lunar_horizon as hz
import lunar_geo as g

SCHEMA_VERSION = "1.0.0"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "..", "public", "data")

PERIOD = {"startUtc": "2027-03-01T00:00:00Z", "endUtc": "2027-04-28T00:00:00Z"}
OUTPUT_STEP_MIN = 60
INTERNAL_STEP_MIN = 5
OBSERVER_HEIGHTS_M = (0.5, 1, 2, 5, 10)
GEOMETRY_REFERENCE_HEIGHT_M = 1
PGDA = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"
IMBRIUM = "https://imbrium.mit.edu"

# Points of interest. None of these is a NASA-selected landing site.
SITES = [
    {
        "id": "connecting-ridge",
        "name": "Connecting ridge (PGDA Site 01, RoI 5)",
        "regionLabel": "Ridge between Shackleton and de Gerlache craters",
        "xy": (-11102.5, -11942.5),
        "pgda": "Site01",
        "coordinateSource": "Centroid of RoI 5 in PGDA Site01_ROIs shapefile (regions with average illumination > 70% at 1 m, Barker et al. 2021)",
    },
    {
        "id": "shackleton-rim",
        "name": "Shackleton rim (PGDA Site 04, RoI 1)",
        "regionLabel": "Rim of Shackleton crater",
        "xy": (-2812.5, -6647.5),
        "pgda": "Site04",
        "coordinateSource": "Centroid of RoI 1 in PGDA Site04_ROIs shapefile (regions with average illumination > 70% at 1 m, Barker et al. 2021)",
    },
    {
        "id": "nobile-rim-1",
        "name": "Nobile rim 1 (PGDA Site 06)",
        "regionLabel": "Rim of Nobile crater",
        "xy": (86002.0, 113742.0),
        "pgda": "Site06",
        "coordinateSource": "60 m pixel with the highest long-term average solar visibility (PDS AVGVISIB_85S_060M_201608) inside the PGDA Site06 5 m DEM, at least 6 km from its edges",
    },
    {
        "id": "malapert-massif",
        "name": "Malapert massif (PGDA Site 23)",
        "regionLabel": "Malapert massif",
        "xy": (-4938.0, 122162.0),
        "pgda": "Site23",
        "coordinateSource": "60 m pixel with the highest long-term average solar visibility (PDS AVGVISIB_85S_060M_201608) inside the PGDA Site23 5 m DEM, at least 6 km from its edges",
    },
]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def runs(mask):
    """Return list of (start_index, end_index_exclusive) for True runs."""
    m = np.concatenate([[False], mask, [False]]).astype(int)
    d = np.diff(m)
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def longest(mask, step_h):
    rs = runs(mask)
    if not rs:
        return 0.0, False
    s, e = max(rs, key=lambda r: r[1] - r[0])
    censored = bool(s == 0 or e == len(mask))
    return round((e - s) * step_h, 2), censored


def r(a, nd=3):
    return [round(float(v), nd) for v in a]


class SiteModel:
    def __init__(self, site, dems_mid_far):
        self.site = site
        near = g.load_pgda_geotiff(os.path.join(CACHE, "dem", site["pgda"],
                                                f"{site['pgda']}_final_adj_5mpp_surf.tif"))
        self.dems = {"near": near, **dems_mid_far}
        self.lat, self.lon = (float(v) for v in g.xy_to_latlon(*site["xy"]))
        prof = hz.horizon_profile(self.lat, self.lon, self.dems, OBSERVER_HEIGHTS_M)
        self.h_terrain = prof["terrain_height_m"]
        self.horizon = prof["elevation_deg"]
        self.reach_m = prof["reach_m"]

    def obs(self, hobs):
        return E.observer_pos_km(self.lat, self.lon, self.h_terrain + hobs)

    def series(self, ets, hobs):
        out = {}
        for body, radius in (("SUN", E.SUN_RADIUS_KM), ("EARTH", E.EARTH_RADIUS_KM)):
            rng, az, el = E.azel(body, ets, self.obs(hobs))
            ang = np.degrees(np.arcsin(radius / rng))
            frac = E.disk_fraction(el, hz.interp_horizon(self.horizon[hobs], az), ang)
            out[body] = {"range": rng, "az": az, "el": el, "ang": ang, "frac": frac}
        return out

    def visible_at(self, body, et, hobs):
        radius = E.SUN_RADIUS_KM if body == "SUN" else E.EARTH_RADIUS_KM
        rng, az, el = E.azel(body, [et], self.obs(hobs))
        ang = np.degrees(np.arcsin(radius / rng))
        return float(E.disk_fraction(el, hz.interp_horizon(self.horizon[hobs], az), ang)[0]) > 0.0


def refine_events(model, body, ets, frac, hobs):
    names = {"SUN": ("sunrise", "sunset"), "EARTH": ("earthrise", "earthset")}[body]
    vis = frac > 0
    events = []
    for i in np.where(vis[1:] != vis[:-1])[0]:
        a, b = ets[i], ets[i + 1]
        va = vis[i]
        while b - a > 30.0:  # bisection to <= 30 s
            m = 0.5 * (a + b)
            if model.visible_at(body, m, hobs) == va:
                a = m
            else:
                b = m
        events.append({
            "type": names[0] if not va else names[1],
            "heightM": hobs,
            "utc": E.et_to_iso(0.5 * (a + b)),
            "resolutionMin": 1,
            "refined": True,
        })
    return events


def main():
    os.makedirs(os.path.join(OUT, "sites"), exist_ok=True)
    E.load_kernels()
    out_times = E.utc_grid(PERIOD["startUtc"], PERIOD["endUtc"], OUTPUT_STEP_MIN)
    in_times = E.utc_grid(PERIOD["startUtc"], PERIOD["endUtc"], INTERNAL_STEP_MIN)
    out_ets = np.array([E.to_et(t) for t in out_times])
    in_ets = np.array([E.to_et(t) for t in in_times])
    step_h = INTERNAL_STEP_MIN / 60.0

    # Eclipse screening (Earth occulting the Sun as seen from the Moon centre).
    occ = np.array([E.earth_occults_sun_from_moon(et) for et in in_ets])
    eclipses = [{"startUtc": E.et_to_iso(in_ets[s]), "endUtc": E.et_to_iso(in_ets[e - 1]),
                 "type": "earth-occults-sun (screened from Moon centre, 5-min grid)"}
                for s, e in runs(occ != 0)]

    mid = g.load_pds_polar_img(os.path.join(CACHE, "dem", "LDEM_80S_80M.IMG"))
    far = g.load_pds_polar_img(os.path.join(CACHE, "dem", "LDEM_75S_240M.IMG"))
    site_entries = []
    for site in SITES:
        model = SiteModel(site, {"mid": mid, "far": far})
        doc = {
            "schemaVersion": SCHEMA_VERSION,
            "siteId": site["id"],
            "horizon": {
                "azimuthStepDeg": hz.AZ_STEP_DEG,
                "azimuthDeg0": 0.0,
                "minReachKm": round(float(model.reach_m.min()) / 1000.0, 1),
                "elevationDeg": {str(h): r(model.horizon[h]) for h in OBSERVER_HEIGHTS_M},
            },
            "sun": {}, "earth": {}, "events": [], "metrics": {}, "eclipses": eclipses,
        }
        reference = model.series(out_ets, GEOMETRY_REFERENCE_HEIGHT_M)
        for body, key in (("SUN", "sun"), ("EARTH", "earth")):
            doc[key]["azDeg"] = r(reference[body]["az"])
            doc[key]["elDeg"] = r(reference[body]["el"])
            doc[key]["angularRadiusDeg"] = r(reference[body]["ang"], 4)
            doc[key]["rangeKm"] = r(reference[body]["range"], 0)
            doc[key]["visibleFraction"] = {}
        for hobs in OBSERVER_HEIGHTS_M:
            so = reference if hobs == GEOMETRY_REFERENCE_HEIGHT_M else model.series(out_ets, hobs)
            si = model.series(in_ets, hobs)
            for body, key in (("SUN", "sun"), ("EARTH", "earth")):
                doc[key]["visibleFraction"][str(hobs)] = r(so[body]["frac"])
                doc["events"] += refine_events(model, body, in_ets, si[body]["frac"], hobs)
            sun_vis = si["SUN"]["frac"] > 0
            earth_vis = si["EARTH"]["frac"] > 0
            lit, lit_c = longest(sun_vis, step_h)
            dark, dark_c = longest(~sun_vis, step_h)
            noe, noe_c = longest(~earth_vis, step_h)
            doc["metrics"][str(hobs)] = {
                "meanSunVisibleFraction": round(float(si["SUN"]["frac"].mean()), 4),
                "sunlitTimeFraction": round(float(sun_vis.mean()), 4),
                "longestSunlitH": lit, "longestSunlitCensored": lit_c,
                "longestNoDirectSunH": dark, "longestNoDirectSunCensored": dark_c,
                "earthVisibleTimeFraction": round(float(earth_vis.mean()), 4),
                "longestNoEarthH": noe, "longestNoEarthCensored": noe_c,
                "durationResolutionMin": INTERNAL_STEP_MIN,
            }
        doc["events"].sort(key=lambda ev: (ev["heightM"], ev["utc"]))
        with open(os.path.join(OUT, "sites", f"{site['id']}.json"), "w", encoding="utf-8", newline="\n") as f:
            json.dump(doc, f, separators=(",", ":"))
        site_entries.append({
            "id": site["id"], "name": site["name"], "regionLabel": site["regionLabel"],
            "latitudeDeg": round(model.lat, 5), "longitudeEastDeg": round(model.lon, 5),
            "terrainElevationM": round(model.h_terrain, 1),
            "polarStereoXYM": [site["xy"][0], site["xy"][1]],
            "coordinateSource": site["coordinateSource"],
            "notALandingSite": True,
            "file": f"sites/{site['id']}.json",
        })
        print(site["id"], doc["metrics"])

    sun, earth, qm, qe = E.sky_vectors(out_ets)
    sky = {
        "schemaVersion": SCHEMA_VERSION,
        "frame": "J2000 (ICRF), Moon-centred, apparent (LT+S)",
        "period": {**PERIOD, "stepMinutes": OUTPUT_STEP_MIN, "sampleCount": len(out_ets)},
        "sunPosKm": [r(v, 0) for v in sun],
        "earthPosKm": [r(v, 1) for v in earth],
        "moonOrientationQuat": [r(q, 7) for q in qm],
        "earthOrientationQuat": [r(q, 7) for q in qe],
        "quaternionConvention": "SPICE m2q (w,x,y,z); rotates J2000 vectors into the body-fixed frame (MOON_ME / IAU_EARTH)",
        "earthOrientationNote": "IAU_EARTH from pck00011.tpc (IAU low-precision rotation model, no nutation). Visual only; not validated against Horizons or ITRF93.",
        "radiiKm": {"sun": E.SUN_RADIUS_KM, "earth": E.EARTH_RADIUS_KM, "moon": 1737.4},
    }
    with open(os.path.join(OUT, "sky.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(sky, f, separators=(",", ":"))

    dem_files = [("LDEM_80S_80M.IMG", f"{IMBRIUM}/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG", "mid (5-100 km)"),
                 ("LDEM_75S_240M.IMG", f"{IMBRIUM}/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG", "far (>100 km)")]
    dem_files += [(f"{s['pgda']}/{s['pgda']}_final_adj_5mpp_surf.tif",
                   f"{PGDA}/{s['pgda']}/{s['pgda']}_final_adj_5mpp_surf.tif", "near (<5 km)") for s in SITES]
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "period": {**PERIOD, "stepMinutes": OUTPUT_STEP_MIN, "sampleCount": len(out_ets)},
        "observerHeightsM": list(OBSERVER_HEIGHTS_M),
        "conventions": {
            "azimuth": "deg clockwise from local north, 0-360",
            "elevation": "deg above the local horizontal plane (sphere normal, R = 1737.4 km)",
            "longitude": "east-positive deg",
            "frame": "MOON_ME (NAIF moon_de440_250416.tf: DE440 PA rotated to DE421 mean-Earth, same frame as LOLA/PGDA DEMs)",
            "time": "UTC; sample i at startUtc + i*stepMinutes",
            "geometryReferenceHeightM": GEOMETRY_REFERENCE_HEIGHT_M,
            "heightCalculation": "Shared azDeg, elDeg, angularRadiusDeg and rangeKm refer to the 1 m observer. Each height has separately computed observer position, horizon, visible fractions, events and metrics; no interpolation between heights.",
            "visibleFraction": "fraction of the body's disk above the terrain horizon; disk cut horizontally at the horizon elevation at the disk-centre azimuth (Barker et al. 2021), uniform disk (no limb darkening)",
            "censored": "true when the longest period touches the start or end of the simulated window: show as >= value",
        },
        "sites": site_entries,
        "provenance": {
            "kernels": [{"file": n, "url": u, "sha256": sha256(os.path.join(E.KERNEL_DIR, n))} for n, u in E.KERNELS],
            "dems": [{"file": f, "url": u, "role": role, "sha256": sha256(os.path.join(CACHE, "dem", f))} for f, u, role in dem_files],
            "references": [
                {"label": "Mazarico et al. 2011, Illumination conditions of the lunar polar regions using LOLA topography, Icarus 211", "doi": "10.1016/j.icarus.2010.10.030"},
                {"label": "Barker et al. 2021, Improved LOLA elevation maps for south pole landing sites, PSS 203", "doi": "10.1016/j.pss.2020.105119"},
                {"label": "PGDA High-Resolution LOLA Topography for Lunar South Pole Sites", "url": "https://pgda.gsfc.nasa.gov/products/78"},
                {"label": "LOLA PDS polar gridded data (LDEM)", "url": "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/"},
                {"label": "NAIF SPICE generic kernels", "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"},
            ],
            "code": "scientific/",
            "generator": "scientific/build_scenes.py",
        },
        "validation": {"file": "validation.json", "status": "pending"},
        "aiDisclosure": "The pipeline code in scientific/ was written with AI coding assistants (Claude Opus 5.5; reviewed with Codex). Every number in public/data/ is computed deterministically by that code from NASA PDS/PGDA LOLA data and NAIF SPICE kernels; no value was produced or edited by a language model.",
        "assumptions": [
            "Bare-terrain horizon from LOLA DEMs: 5 m PGDA (<5 km), 80 m PDS (5-100 km), 240 m PDS (>100 km), 720 azimuths, great-circle sight lines, exact spherical geometry.",
            "Observer heights 0.5, 1, 2, 5 and 10 m above the local terrain surface; heights describe the model observer, not DEM vertical accuracy.",
            "Sun and Earth treated as uniform disks; Earth visibility is geometric line of sight only.",
            f"Durations and metrics from a {INTERNAL_STEP_MIN}-min grid; rise/set times refined by bisection to <= 30 s and reported with 1-min resolution.",
        ],
        "limitations": [
            "Points of interest from published LOLA studies; not NASA-selected landing sites and not mission recommendations.",
            "No power, battery, thermal, communications-link (DSN), landing-safety or hazard assessment.",
            "Visibility windows shorter than the internal grid step may be missed.",
            "DEM interpolation, boulders and sub-pixel relief are not modelled; near-field horizon is sensitive to DEM error at low observer heights, especially 0.5 m and 1 m (Barker et al. 2021); a 0.5 m model height does not imply 0.5 m terrain accuracy.",
            "Results only cover the stated period; dates outside it are not computed.",
        ],
    }
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=1)
    print("eclipses", eclipses)


if __name__ == "__main__":
    main()
