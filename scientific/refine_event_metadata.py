"""Reproduce eclipse-near solar brackets and correct cause labels only.

Run with local readers/watchers stopped: python -u refine_event_metadata.py
No time series, metrics, horizons, or UTC events are changed. All numerical
fields must compare equal before promotion; repeated execution is idempotent.
"""
from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import shutil

import numpy as np

import build_scenes as B
import hash_dataset
import lunar_ephem as E
import lunar_geo as g
from verify_coverage import dataset_checks, eclipse_checks, event_cause_checks, regression


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def dt(text):
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def main():
    assert event_cause_checks()["pass"]
    here = Path(__file__).resolve().parent
    live = here.parent/"public"/"data"
    stage = here/"cache"/"event-metadata-staging"
    if stage.exists():
        raise FileExistsError("An existing event-metadata staging directory needs inspection")
    shutil.copytree(live, stage)
    manifest = read(stage/"manifest.json")
    B.OUT = str(stage)
    B.PERIOD = {k: manifest["period"][k] for k in ("startUtc", "endUtc")}
    E.load_kernels()
    mid = g.load_pds_polar_img(str(here/"cache"/"dem"/"LDEM_80S_80M.IMG"))
    far = g.load_pds_polar_img(str(here/"cache"/"dem"/"LDEM_75S_240M.IMG"))
    epoch = dt(manifest["period"]["startUtc"])
    step = B.INTERNAL_STEP_MIN*60
    bracket = float(step)
    while bracket > 30:
        bracket /= 2
    changed, examined = [], 0
    for site in B.SITES:
        model = B.SiteModel(site, {"mid": mid, "far": far})
        path = stage/"sites"/(site["id"]+".json")
        original = read(path)
        doc = copy.deepcopy(original)
        for event in doc["events"]:
            event["refinementBracketSec"] = bracket
            if event["type"] not in ("sunrise", "sunset", "eclipseDarknessStart", "eclipseDarknessEnd"):
                continue
            instant = dt(event["utc"])
            h = event["heightM"]
            near = any(x["heightM"] == h and dt(x["startUtc"])-timedelta(seconds=step) <= instant <= dt(x["endUtc"])+timedelta(seconds=step)
                       for x in doc["eclipses"])
            if not near:
                continue
            examined += 1
            cell = int((instant-epoch).total_seconds()//step)
            matches = []
            for delta in (0, -1, 1):
                a = epoch+timedelta(seconds=(cell+delta)*step)
                b = a+timedelta(seconds=step)
                if a < epoch or b > dt(manifest["period"]["endUtc"]):
                    continue
                ets = np.array([E.to_et(a), E.to_et(b)])
                values = model.series(ets, h)["SUN"]["frac"]
                if (values[0] > 0) == (values[1] > 0):
                    continue
                found = B.refine_events(model, "SUN", ets, values, h)
                matches += [x for x in found if x["utc"] == event["utc"]]
            if len(matches) != 1:
                raise ValueError(f"Cannot reproduce exact stored bracket: {site['id']} {event}")
            replacement = matches[0]
            if replacement["type"] != event["type"] or replacement["cause"] != event.get("cause"):
                changed.append({"site": site["id"], "heightM": h, "utc": event["utc"],
                                "before": {k: event.get(k) for k in ("type", "cause")},
                                "after": {k: replacement[k] for k in ("type", "cause")}})
            event.update({k: replacement[k] for k in ("type", "cause", "refinementBracketSec")})
        for event in doc["eclipseEvents"]:
            event["refinementBracketSec"] = bracket
        # Exhaustive equality of all published quantities except allowed metadata.
        assert len(doc["events"]) == len(original["events"])
        for a, b in zip(original["events"], doc["events"]):
            assert all(b[k] == v for k, v in a.items() if k not in ("type", "cause", "refinementBracketSec"))
        for a, b in zip(original["eclipseEvents"], doc["eclipseEvents"]):
            assert all(b[k] == v for k, v in a.items() if k != "refinementBracketSec")
        a, b = copy.deepcopy(original), copy.deepcopy(doc)
        for x in (a, b):
            x.pop("events"); x.pop("eclipseEvents")
        assert a == b
        path.write_text(json.dumps(doc, separators=(",", ":")), encoding="utf-8", newline="\n")
        print(site["id"], "metadata checked", flush=True)
    result = dataset_checks(stage)
    assert result["pass"], result
    assert eclipse_checks()["pass"]
    old_reg = regression(stage, here/"cache"/"year-extension-baseline")
    assert old_reg["pass"], old_reg
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    record = {"checkedAtUtc": now, "nearEclipseSolarBracketsReproduced": examined,
              "changedCauseLabels": changed, "changedCount": len(changed),
              "numericalFieldsUnchanged": True, "refinementBracketSec": bracket,
              "generator": "scientific/refine_event_metadata.py"}
    validation = read(stage/"validation.json")
    for check in validation["tests"]:
        if check["id"] == "V7":
            check["result"] = result
            check["method"] += " Counterfactual terrain bracket cause checks; actual numerical refinement brackets <=30 seconds."
    validation["eventMetadataCorrection"] = record
    (stage/"validation.json").write_text(json.dumps(validation, indent=1)+"\n", encoding="utf-8", newline="\n")
    manifest["provenance"]["eventMetadataCorrection"] = record
    manifest["provenance"]["generationEnvironment"]["generatorCodeSha256"] = {p.name: B.sha256(p) for p in sorted(here.glob("*.py"))}
    (stage/"manifest.json").write_text(json.dumps(manifest, indent=1)+"\n", encoding="utf-8", newline="\n")
    hash_dataset.main(stage)
    for item in read(stage/"integrity.json")["files"]:
        path = stage/item["file"]
        assert B.sha256(path) == item["sha256"]
        assert b"\r\n" not in path.read_bytes()
        assert path.stat().st_size < 25_000_000
    backup = here/"cache"/("event-metadata-previous-"+datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S"))
    os.replace(live, backup)
    try:
        os.replace(stage, live)
    except BaseException:
        os.replace(backup, live)
        raise
    for item in read(live/"integrity.json")["files"]:
        assert B.sha256(live/item["file"]) == item["sha256"]
    (here/"cache"/"event-metadata-correction.json").write_text(json.dumps(record, indent=2)+"\n", encoding="utf-8", newline="\n")
    print("PROMOTED", json.dumps(record), flush=True)


if __name__ == "__main__":
    main()
