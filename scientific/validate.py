"""Validation checks for the generated scene data -> public/data/validation.json.

Run from scientific/:  PYTHONPATH=. python -P validate.py [--horizons]
Targets below were fixed in this file before the checks were run, except
where a test's notes say otherwise. A test is never marked "pass" without
being executed; a skipped test stays "pending".
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import numpy as np

import build_scenes as B
import lunar_ephem as E
import lunar_geo as g
import lunar_horizon as hz

HORIZONS_CACHE = os.path.join(B.CACHE, "horizons")
USER_AGENT = "LunarLandingSiteNavigator/0.1 (NASA Space Apps 2026 hackathon project; offline validation, serial requests)"


def test(tid, title, method, metric, target, result, status, evidence, notes=""):
    return {"id": tid, "title": title, "method": method, "metric": metric, "target": target,
            "result": result, "status": status, "evidence": evidence, "notes": notes}


def unit_from_azel(az_deg, el_deg):
    az = np.radians(az_deg)
    el = np.radians(el_deg)
    return np.stack([np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)], axis=-1)


# ---------------------------------------------------------------- V1 Horizons
def horizons_query(body_id, lon, lat, alt_km, tlist):
    os.makedirs(HORIZONS_CACHE, exist_ok=True)
    key = f"{body_id}_{lon:.5f}_{lat:.5f}_{alt_km:.5f}_{hashlib.sha1("|".join(tlist).encode()).hexdigest()[:10]}.txt"
    path = os.path.join(HORIZONS_CACHE, key)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read(), True
    params = {
        "format": "text", "COMMAND": f"'{body_id}'", "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'", "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon:.6f},{lat:.6f},{alt_km:.6f}'",
        "TLIST": " ".join(f"'{t}'" for t in tlist), "TLIST_TYPE": "'CAL'", "TIME_TYPE": "'UT'",
        "QUANTITIES": "'4'", "ANG_FORMAT": "'DEG'", "TIME_DIGITS": "'SECONDS'", "CSV_FORMAT": "'YES'",
    }
    url = "https://ssd.jpl.nasa.gov/api/horizons.api?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        text = resp.read().decode("utf-8")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    time.sleep(2.0)  # serial, one request at a time
    return text, False


def parse_horizons(text):
    body = text.split("$$SOE")[1].split("$$EOE")[0]
    rows = []
    for line in body.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        rows.append((float(parts[3]), float(parts[4])))
    return np.array(rows)


def v1_horizons(models):
    times = ["2027-03-01 00:00:00", "2027-03-08 06:00:00", "2027-03-20 12:00:00",
             "2027-04-05 18:00:00", "2027-04-27 23:00:00"]
    seps, rows, calls = [], [], 0
    for m in models:
        for body, bid in (("SUN", "10"), ("EARTH", "399")):
            alt_km = (m.h_terrain + 1.0) / 1000.0
            text, cached = horizons_query(bid, m.lon, m.lat, alt_km, times)
            calls += 0 if cached else 1
            ref = parse_horizons(text)
            ets = [E.to_et(datetime.fromisoformat(t).replace(tzinfo=timezone.utc)) for t in times]
            _, az, el = E.azel(body, ets, m.obs(1))
            sep = np.degrees(np.arccos(np.clip(np.sum(unit_from_azel(az, el) * unit_from_azel(ref[:, 0], ref[:, 1]), axis=1), -1, 1)))
            seps += list(sep)
            rows.append({"site": m.site["id"], "body": body, "maxSepDeg": round(float(sep.max()), 5)})
    seps = np.array(seps)
    p95 = float(np.percentile(seps, 95))
    return test(
        "V1", "Ephemeris vs JPL Horizons",
        "Apparent airless az/el of Sun and Earth from each site (terrain + 1 m) at 5 UTC instants: SPICE azlcpo (LT+S, DE440s, MOON_ME) vs Horizons API (DE441, coord@301), angular separation of direction vectors.",
        "p95 and max angular separation (deg), n = %d" % seps.size,
        "p95 < 0.01 deg (max and outliers reported)",
        {"p95Deg": round(p95, 5), "maxDeg": round(float(seps.max()), 5), "n": int(seps.size), "perSiteBody": rows,
         "newHorizonsRequests": calls},
        "pass" if p95 < 0.01 else "fail",
        "Horizons responses cached in scientific/cache/horizons/ (not versioned); serial requests with identifying User-Agent.",
        "Agreement holds only for the sampled instants and site/body pairs listed in this result, limited by the 1e-6 deg precision printed by Horizons. It is not a general proof of equality for every site, time or body.",
    )


# ---------------------------------------------------------------- V2 datum
def v2_datum(mid):
    rows = []
    worst = 0.0
    for s in {s["pgda"]: s for s in B.SITES}.values():
        p = g.load_pgda_geotiff(os.path.join(B.CACHE, "dem", s["pgda"], f"{s['pgda']}_final_adj_5mpp_surf.tif"))
        n = 16
        a = p.data
        h, w = (a.shape[0] // n) * n, (a.shape[1] // n) * n
        blk = a[:h, :w].reshape(h // n, n, w // n, n).mean(axis=(1, 3))
        rr, cc = np.mgrid[0:h // n, 0:w // n]
        xs = (p.x0 + (cc * n + (n - 1) / 2) * p.scale).ravel()
        ys = (p.y0 - (rr * n + (n - 1) / 2) * p.scale).ravel()
        shifts = {}
        for dx in (-80, 0, 80):
            for dy in (-80, 0, 80):
                d = blk.ravel() - mid.sample(xs + dx, ys + dy)
                shifts[(dx, dy)] = float(np.nanmedian(np.abs(d)))
        d0 = blk.ravel() - mid.sample(xs, ys)
        d0 = d0[np.isfinite(d0)]
        best = min(shifts, key=lambda k: shifts[k])
        med = float(np.median(d0))
        worst = max(worst, abs(med))
        rows.append({"site": s["pgda"], "medianDiffM": round(med, 2),
                     "madM": round(float(np.median(np.abs(d0 - med))), 2),
                     "p95AbsM": round(float(np.percentile(np.abs(d0), 95)), 2),
                     "bestShiftM": list(best), "n": int(d0.size)})
    ok = worst < 2.0 and all(r["bestShiftM"] == [0, 0] for r in rows)
    return test(
        "V2", "Vertical datum and registration: PGDA 5 m vs PDS LDEM 80 m",
        "PGDA 5 m DEM block-averaged to 80 m cells and compared with LDEM_80S_80M bilinear samples at the same polar-stereographic X/Y; also +/-80 m shifts.",
        "median difference (systematic offset), MAD, best shift",
        "|median| < 2 m at every site and best shift = (0,0)",
        rows, "pass" if ok else "fail",
        "scientific/validate.py v2_datum",
        "Exploratory first run on 2026-11-14 preceded writing this target (median 0.2-0.3 m observed); stated for transparency.",
    )


# ---------------------------------------------------------------- V3 convergence
def v3_convergence(models):
    rows = []
    worst = 0.0
    for m in models:
        full = m.horizon[1]
        cut = hz.horizon_profile(m.lat, m.lon, m.dems, [1], max_range_m=300e3,
                                 terrain_height_m=m.h_terrain)["elevation_deg"][1]
        d = float(np.abs(cut - full).max())
        worst = max(worst, d)
        rows.append({"site": m.site["id"], "maxAbsDiffDeg": round(d, 4),
                     "minReachKm": round(float(m.reach_m.min()) / 1000, 1)})
    return test(
        "V3", "Horizon range convergence",
        "Horizon at 1 m computed with sight lines truncated at 300 km vs full DEM coverage.",
        "max |delta horizon| over 720 azimuths",
        "< 0.01 deg at every site",
        rows, "pass" if worst < 0.01 else "fail", "scientific/validate.py v3_convergence")


# ---------------------------------------------------------------- V4 Barker period test
def v4_barker(models, mid, far):
    times = E.utc_grid("2024-01-01T00:00:00Z", "2026-01-01T00:00:00Z", 60)
    ets = [E.to_et(t) for t in times]
    rows = []
    ok = True
    for m in models:
        if m.site["id"] not in ("connecting-ridge", "shackleton-rim"):
            continue
        frac = m.series(ets, 1)["SUN"]["frac"]
        mean = float(frac.mean())
        ok &= mean > 0.70
        rows.append({"site": m.site["id"], "meanVisibleFraction2024to2026At1m": round(mean, 4)})
    return test(
        "V4", "Reproduce Barker et al. (2021) illumination class",
        "Our points are centroids of PGDA RoIs defined as regions with average illumination > 70% at 1 m between 2024-01-01 and 2026-01-01. Same period, height and definition (mean visible fraction of the solar disk), hourly.",
        "mean visible solar-disk fraction, 2024-2026, 1 m",
        "> 0.70 at both RoI centroids",
        rows, "pass" if ok else "fail", "scientific/validate.py v4_barker",
        "Differences expected from limb darkening (not modelled here) and from using the RoI centroid rather than every RoI pixel.")


def v4b_pgda(models):
    av = g.load_pds_polar_map(os.path.join(B.CACHE, "dem", "AVGVISIB_85S_060M_201608.IMG"))
    rows = []
    times = E.utc_grid("2024-01-01T00:00:00Z", "2026-01-01T00:00:00Z", 60)
    ets = [E.to_et(t) for t in times]
    for m in models:
        x, y = m.site["xy"]
        pg = float(av.sample(np.array([x]), np.array([y]))[0])
        ours = float(m.series(ets, 1)["SUN"]["frac"].mean())
        rows.append({"site": m.site["id"], "pgda18yrAvgVisibility60m": round(pg, 3),
                     "ours2024to2026At1m": round(ours, 3)})
    return test(
        "V4b", "Context: PGDA 18.6-year average illumination map",
        "Our 2-year hourly mean at 1 m vs PDS AVGVISIB_85S_060M_201608 at the same point.",
        "values side by side", "qualitative only (different period, resolution and DEM)",
        rows, "info", "scientific/validate.py v4b_pgda",
        "Not a pass/fail test. Two of the points were chosen as PGDA maxima, which biases this comparison.")


# ---------------------------------------------------------------- V5 sanity
def v5_sanity(models, mid, far):
    rows = []
    ok = True
    for m in models:
        with open(os.path.join(B.OUT, "sites", m.site["id"] + ".json"), encoding="utf-8") as f:
            generated = json.load(f)
        pairs = []
        for lower, upper in zip(B.OBSERVER_HEIGHTS_M, B.OBSERVER_HEIGHTS_M[1:]):
            mono_h = bool(np.all(m.horizon[upper] <= m.horizon[lower] + 1e-9))
            fractions = {}
            for body in ("sun", "earth"):
                lo = np.asarray(generated[body]["visibleFraction"][str(lower)])
                hi = np.asarray(generated[body]["visibleFraction"][str(upper)])
                fractions[body] = bool(np.all(hi >= lo - 1e-12))
            ok &= mono_h and all(fractions.values())
            pairs.append({"lowerM": lower, "upperM": upper,
                          "higherHorizonNotAboveLower": mono_h,
                          "higherVisibleFractionNotBelowLower": fractions})
        rows.append({"site": m.site["id"], "adjacentHeightPairs": pairs})
    # Permanently shadowed pixel inside Shackleton (PDS LPSR_85S_060M = 1).
    lpsr = g.load_pds_polar_map(os.path.join(B.CACHE, "dem", "LPSR_85S_060M_201608.IMG"))
    lat, lon = -89.67, 129.78
    x, y = g.latlon_to_xy(lat, lon)
    psr = float(lpsr.sample(np.array([x]), np.array([y]))[0])
    prof = hz.horizon_profile(lat, lon, {"near": mid, "mid": mid, "far": far}, [1])
    times = E.utc_grid("2024-01-01T00:00:00Z", "2026-01-01T00:00:00Z", 60)
    ets = [E.to_et(t) for t in times]
    _, az, el = E.azel("SUN", ets, E.observer_pos_km(lat, lon, prof["terrain_height_m"] + 1))
    rng, _, _ = E.azel("SUN", ets[:1], E.observer_pos_km(lat, lon, prof["terrain_height_m"] + 1))
    ang = np.degrees(np.arcsin(E.SUN_RADIUS_KM / rng[0]))
    frac = E.disk_fraction(el, hz.interp_horizon(prof["elevation_deg"][1], az), ang)
    psr_ok = psr == 1.0 and float(frac.max()) == 0.0
    ok &= psr_ok
    rows.append({"psrPixel": {"latDeg": lat, "lonEastDeg": lon, "lpsrValue": psr,
                              "maxSunFraction2024to2026": round(float(frac.max()), 4)}})
    return test(
        "V5", "Sanity: height monotonicity and a permanently shadowed pixel",
        "For every adjacent pair of observer heights (0.5, 1, 2, 5, 10 m), the higher horizon must not exceed the lower and generated hourly Sun/Earth visible fractions must not decrease; a pixel flagged permanently shadowed in PDS LPSR_85S_060M (Shackleton floor, 80 m DEM near field) must receive no direct sunlight hourly over 2024-2026.",
        "booleans; max solar-disk fraction at PSR pixel", "all true; PSR max fraction = 0",
        rows, "pass" if ok else "fail", "scientific/validate.py v5_sanity",
        "PSR test uses the 80 m DEM as near field (no 5 m PGDA tile covers this pixel).")


def main():
    use_horizons = "--horizons" in sys.argv
    E.load_kernels()
    mid = g.load_pds_polar_img(os.path.join(B.CACHE, "dem", "LDEM_80S_80M.IMG"))
    far = g.load_pds_polar_img(os.path.join(B.CACHE, "dem", "LDEM_75S_240M.IMG"))
    models = [B.SiteModel(s, {"mid": mid, "far": far}) for s in B.SITES]
    tests = []
    if use_horizons:
        tests.append(v1_horizons(models))
    else:
        tests.append(test("V1", "Ephemeris vs JPL Horizons", "see validate.py", "p95 separation",
                          "p95 < 0.01 deg", None, "pending", "", "Not run in this invocation."))
    tests += [v2_datum(mid), v3_convergence(models), v4_barker(models, mid, far), v4b_pgda(models),
              v5_sanity(models, mid, far)]
    doc = {"schemaVersion": B.SCHEMA_VERSION,
           "generatedAtUtc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "tests": tests}
    with open(os.path.join(B.OUT, "validation.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, indent=1)
    for t in tests:
        print(t["id"], t["status"], json.dumps(t["result"])[:400])
    statuses = [t["status"] for t in tests if t["status"] != "info"]
    status = ("failed" if "fail" in statuses else
              "pending" if all(s == "pending" for s in statuses) else
              "partial" if "pending" in statuses else "done")
    man_path = os.path.join(B.OUT, "manifest.json")
    with open(man_path, encoding="utf-8") as f:
        man = json.load(f)
    man["validation"]["status"] = status
    man["validation"]["summary"] = {t["id"]: t["status"] for t in tests}
    with open(man_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(man, f, indent=1)


if __name__ == "__main__":
    main()
