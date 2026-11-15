"""Acceptance checks for rolling coverage and solar angular-disk integration."""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import lunar_eclipse as ec


def eclipse_checks():
    # Targets fixed before the first run: convergence <2e-5; independent chord
    # midpoint integration <1e-4; analytic no/full/half eclipse cases <1e-8.
    cases = [(1, 1, 0, 0, 0, 0), (1, 2, 0, 0, -2, 0),
             (1, 1, 3, 0, 0, 0.5), (1, 0.5, 0, 0, -2, 0.75),
             (1, 0.5, 0, 0, 0, 0.375),
             (1, 1.5, 0, 1, 0.5, 0)]
    analytic = max(abs(ec.visible_fraction(*c[:5])-c[5]) for c in cases)
    rng = np.random.default_rng(20261115)
    conv, independent = [], []
    for _ in range(80):
        R = rng.uniform(0.2, 4.5)
        theta = rng.uniform(-np.pi, np.pi)
        dist = rng.uniform(abs(R-1)+1e-5, R+1-1e-5)
        cx, cy = dist*np.cos(theta), dist*np.sin(theta)
        h = rng.uniform(-0.999, 0.999)
        f128 = ec.visible_fraction(1, R, cx, cy, h, 128)
        f256 = ec.visible_fraction(1, R, cx, cy, h, 256)
        conv.append(abs(f128-f256))
        # Independent midpoint area: directly sum the unocculted portions of
        # every solar horizontal chord, not analytic terrain minus blocked area.
        n = 100000
        dy = (1-h)/n
        ys = h+(np.arange(n)+0.5)*dy
        sx = np.sqrt(np.maximum(0, 1-ys*ys))
        inside = np.abs(ys-cy) < R
        ex = np.sqrt(np.maximum(0, R*R-(ys-cy)**2))
        blocked = np.where(inside, np.maximum(0, np.minimum(sx, cx+ex)-np.maximum(-sx, cx-ex)), 0)
        ref = float(np.sum(2*sx-blocked)*dy/np.pi)
        independent.append(abs(f128-ref))
    result = {"analyticMaxError": analytic, "quadrature128vs256MaxError": max(conv),
              "independent100000ChordMaxError": max(independent), "cases": len(cases)+80,
              "targets": {"analytic": 1e-8, "convergence": 2e-5, "independent": 1e-4}}
    result["pass"] = analytic < 1e-8 and max(conv) < 2e-5 and max(independent) < 1e-4
    return result


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def event_cause_checks():
    import build_scenes as B
    cases = []
    # Earth's upper limb ends at y=0. The solar cap emerging above y=.99
    # cannot be blocked by Earth, even though the lower Sun is in an eclipse.
    for cx in np.linspace(-0.5, 0.5, 10):
        before = ec.visible_fraction(1, 1, cx, -1, 1.01) > 0
        after = ec.visible_fraction(1, 1, cx, -1, 0.99) > 0
        cases.append(B.solar_transition_type(before, False, True) == ("sunrise", "terrain") and not before and after)
        cases.append(B.solar_transition_type(after, True, False) == ("sunset", "terrain"))
    cases.append(B.solar_transition_type(True, True, True) == ("eclipseDarknessStart", "earth-occultation"))
    cases.append(B.solar_transition_type(False, True, True) == ("eclipseDarknessEnd", "earth-occultation"))
    return {"pass": bool(all(cases)), "cases": len(cases),
            "method": "20 terrain-cap transitions during overlapping disks plus two actual Earth-only counterfactual transitions"}


def dataset_checks(out):
    out = Path(out)
    manifest = load(out/"manifest.json")
    period = manifest["period"]
    n = period["sampleCount"]
    start = datetime.fromisoformat(period["startUtc"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(period["endUtc"].replace("Z", "+00:00"))
    hours = (end-start).total_seconds()/3600
    errors = []
    if n != int(hours)+1 or period["stepMinutes"] != 60:
        errors.append("coverage count/step")
    for name in ("sky.json", "planets.json"):
        if load(out/name)["period"] != period:
            errors.append(name+" period mismatch")
    rows = []
    for entry in manifest["sites"]:
        doc = load(out/entry["file"])
        for body in ("sun", "earth"):
            for key in ("azDeg", "elDeg", "angularRadiusDeg", "rangeKm"):
                arr = np.asarray(doc[body][key])
                if len(arr) != n or not np.isfinite(arr).all():
                    errors.append(entry["id"]+body+key)
        for h in manifest["observerHeightsM"]:
            key = str(h)
            sf = np.asarray(doc["sun"]["visibleFraction"][key])
            tf = np.asarray(doc["sun"]["terrainVisibleFraction"][key])
            uf = np.asarray(doc["sun"]["eclipseUnobscuredFraction"][key])
            ef = np.asarray(doc["earth"]["visibleFraction"][key])
            for arr in (sf, tf, uf, ef):
                if len(arr) != n or not np.isfinite(arr).all() or np.any((arr < 0)|(arr > 1)):
                    errors.append(entry["id"]+key+" fraction bounds/shape")
            if np.any(sf > tf+1e-12) or np.any(sf > uf+1e-12):
                errors.append(entry["id"]+key+" joint fraction exceeds single constraint")
            met = doc["metrics"][key]
            for k, v in met.items():
                if k.endswith("H") and not 0 <= v <= hours+0.01:
                    errors.append(entry["id"]+key+k+" exceeds actual duration")
        for ev in doc["events"]+doc["eclipseEvents"]:
            if not period["startUtc"] <= ev["utc"] <= period["endUtc"]:
                errors.append(entry["id"]+" event outside coverage")
            if not 0 < ev.get("refinementBracketSec", 0) <= 30:
                errors.append(entry["id"]+" missing/invalid numerical refinement bracket")
        for interval in doc["eclipses"]:
            if not period["startUtc"] <= interval["startUtc"] <= interval["endUtc"] <= period["endUtc"]:
                errors.append(entry["id"]+" eclipse outside coverage")
        rows.append({"site": entry["id"], "samples": n, "eclipseIntervalsAllHeights": len(doc["eclipses"])})
    causes = event_cause_checks()
    if not causes["pass"]:
        errors.append("solar event cause counterfactual regression")
    return {"pass": not errors, "errors": errors, "sites": rows, "intervalHours": hours,
            "solarTransitionCauseChecks": causes,
            "numericalContactBracketTargetSec": 30,
            "accuracyNote": "Numerical bracket target only; not a claim of physical eclipse contact-time accuracy."}


def regression(out, baseline):
    out, baseline = Path(out), Path(baseline)
    old, new = load(baseline/"manifest.json"), load(out/"manifest.json")
    start = datetime.fromisoformat(new["period"]["startUtc"].replace("Z", "+00:00"))
    oldstart = datetime.fromisoformat(old["period"]["startUtc"].replace("Z", "+00:00"))
    offset = int((oldstart-start).total_seconds()/3600)
    count = old["period"]["sampleCount"]
    covered = offset >= 0 and offset+count <= new["period"]["sampleCount"]
    rows = []
    if not covered:
        return {"pass": True, "status": "not-overlapping", "note": "Baseline interval lies outside requested coverage; no regression claim made."}
    for site in old["sites"]:
        a, b = load(baseline/site["file"]), load(out/site["file"])
        eq = a["horizon"] == b["horizon"]
        for body in ("sun", "earth"):
            for key in ("azDeg", "elDeg", "angularRadiusDeg", "rangeKm"):
                eq &= a[body][key] == b[body][key][offset:offset+count]
            for h, arr in a[body]["visibleFraction"].items():
                eq &= arr == b[body]["visibleFraction"][h][offset:offset+count]
        # New events carry an explicit cause; compare original fields only.
        events = [{k: ev[k] for k in ("type", "heightM", "utc", "resolutionMin", "refined")}
                  for ev in b["events"] if old["period"]["startUtc"] <= ev["utc"] <= old["period"]["endUtc"]]
        eq &= events == a["events"]
        eq &= site == next(x for x in new["sites"] if x["id"] == site["id"])
        rows.append({"site": site["id"], "allOriginalGeometryFractionsHorizonEventsEqual": bool(eq)})
    a, b = load(baseline/"sky.json"), load(out/"sky.json")
    sky = all(a[k] == b[k][offset:offset+count] for k in
              ("sunPosKm", "earthPosKm", "moonOrientationQuat", "earthOrientationQuat"))
    a, b = load(baseline/"planets.json"), load(out/"planets.json")
    planets = all(x["posKm"] == next(y for y in b["planets"] if x["id"] == y["id"])["posKm"][offset:offset+count]
                  for x in a["planets"])
    return {"pass": bool(sky and planets and all(r["allOriginalGeometryFractionsHorizonEventsEqual"] for r in rows)),
            "offsetHourlySamples": offset, "comparedSamples": count, "sites": rows,
            "skyEqual": sky, "planetsEqual": planets,
            "note": "Annual metrics intentionally differ; baseline-window metric reproduction is checked independently during scene generation."}
