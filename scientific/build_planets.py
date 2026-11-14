"""Optional Solar System context -> public/data/planets.json (visual only).

Separate from the core dataset: nothing in manifest/sky/sites depends on it.
Run from scientific/:  PYTHONPATH=. python -P build_planets.py
"""
from __future__ import annotations

import json
import os

import numpy as np
import spiceypy as sp

import build_scenes as B
import lunar_ephem as E

# DE440s only carries planetary system barycentres (IDs 1-9) for these bodies.
PLANETS = [
    ("mercury", "Mercury", "1", 199, "#b8b2a7"),
    ("venus", "Venus", "2", 299, "#e8d3a2"),
    ("mars", "Mars", "4", 499, "#d0703f"),
    ("jupiter", "Jupiter", "5", 599, "#d8b48a"),
    ("saturn", "Saturn", "6", 699, "#e3cf98"),
    ("uranus", "Uranus", "7", 799, "#9fd8e0"),
    ("neptune", "Neptune", "8", 899, "#5b7fd6"),
]
NOTE_SAME = ("Barycentre of the {name} system from DE440s. {name} has no natural satellites, "
             "so the barycentre coincides with the planet centre.")
NOTE_BARY = ("Barycentre of the {name} system from DE440s, used as a proxy for the planet centre "
             "(not the planet centre itself). The offset is negligible at this display's angular scale.")


def main():
    E.load_kernels()
    times = E.utc_grid(B.PERIOD["startUtc"], B.PERIOD["endUtc"], B.OUTPUT_STEP_MIN)
    ets = [E.to_et(t) for t in times]
    planets = []
    for pid, name, target, body_code, color in PLANETS:
        radius = float(np.mean(sp.bodvcd(body_code, "RADII", 3)[1]))
        pos = [sp.spkpos(target, et, "J2000", E.ABCORR, "MOON")[0] for et in ets]
        planets.append({
            "id": pid, "name": name, "radiusKm": round(radius, 1), "color": color,
            "spiceTarget": f"{target} ({name.upper()} BARYCENTER)",
            "positionNote": (NOTE_SAME if pid in ("mercury", "venus") else NOTE_BARY).format(name=name),
            "posKm": [[round(float(v), 0) for v in p] for p in pos],
        })
    doc = {
        "schemaVersion": B.SCHEMA_VERSION,
        "purpose": "Optional visual Solar System context. Not used by any terrain, visibility or metric calculation.",
        "period": {**B.PERIOD, "stepMinutes": B.OUTPUT_STEP_MIN, "sampleCount": len(ets)},
        "frame": "J2000 (ICRF), Moon-centred, apparent (LT+S)",
        "radiusNote": "Mean of the three PCK radii (pck00011.tpc). Shown for apparent size only.",
        "planets": planets,
        "validation": "Not compared with Horizons. Same SPICE call path as sky.json (spkpos, LT+S), which V1 checks only for the Sun and Earth seen from the sites.",
        "limitations": [
            "System barycentres stand in for the centres of Mars, Jupiter, Saturn, Uranus and Neptune.",
            "Visual context only. No visibility, occultation or brightness modelling for planets.",
        ],
        "provenance": {
            "kernels": ["de440s.bsp", "pck00011.tpc", "naif0012.tls"],
            "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/",
            "generator": "scientific/build_planets.py",
        },
    }
    with open(os.path.join(B.OUT, "planets.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, separators=(",", ":"))
    for p in planets:
        d = np.linalg.norm(p["posKm"][0]) / 1.495978707e8
        print(p["id"], p["radiusKm"], "dist0 %.3f au" % d)


if __name__ == "__main__":
    main()
