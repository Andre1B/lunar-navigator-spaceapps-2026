"""Generate, validate, hash and promote one complete, pinned scientific dataset.

python -u rebuild.py --as-of 2026-11-15
python -u rebuild.py --start 2027-03-01 --end 2028-03-01
--output-dir generates a validated dataset there without promoting public/data.
No network calls. Daily scheduling/deployment is managed outside scientific/.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import platform
import shutil
from pathlib import Path

import numpy as np
import spiceypy

import build_scenes as B
import build_planets
import coverage as coverage_config
import hash_dataset
import validate
from verify_coverage import eclipse_checks, regression


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main():
    args = coverage_config.configure(B)
    here = Path(__file__).resolve().parent
    live = here.parent/"public"/"data"
    stage = Path(B.OUT) if args.output_dir else here/"cache"/"rolling-staging"
    backup = live.parent/".data-previous"
    if stage.resolve() == live.resolve():
        raise ValueError("--output-dir must not be public/data; use staging")
    if not args.output_dir and backup.exists():
        raise RuntimeError("Previous promotion backup exists; resolve interrupted promotion before rebuilding")
    # Compare all cached source bytes against a version-controlled lock, before
    # expensive computation. A daily refresh never silently adopts new sources.
    lock = read(here/"source-lock.json")
    for item in lock["files"]:
        path = here/"cache"/item["cachePath"]
        if B.sha256(path) != item["sha256"]:
            raise ValueError(f"Pinned input missing or changed: {path}")
    for item in lock.get("references", []):
        if B.sha256(here/item["relativePath"]) != item["sha256"]:
            raise ValueError("Bundled historical Horizons reference changed")
    if not eclipse_checks()["pass"]:
        raise RuntimeError("Eclipse numerical validation failed")
    if args.resume_staging:
        if not stage.is_dir():
            raise FileNotFoundError("No staging dataset to resume")
        staged_manifest = read(stage/"manifest.json")
        if any(staged_manifest["period"][k] != v for k, v in B.PERIOD.items()):
            raise ValueError("Staging period differs from requested coverage")
        saved_hashes = staged_manifest.get("provenance", {}).get("generationEnvironment", {}).get("generatorCodeSha256", {})
        for name in ("build_scenes.py", "build_planets.py", "lunar_ephem.py", "lunar_geo.py", "lunar_horizon.py", "lunar_eclipse.py"):
            if saved_hashes.get(name) != B.sha256(here/name):
                raise ValueError(f"Cannot reuse staged calculations after changing {name}")
    elif stage.exists():
        if args.output_dir:
            raise ValueError("Explicit output directory must not already exist")
        # Only this fixed, resolved generated cache directory is replaceable.
        if (stage.is_symlink() or stage.name != "rolling-staging"
                or stage.resolve().parent != (here/"cache").resolve()
                or not stage.resolve().is_relative_to(here.parent.resolve())):
            raise ValueError("Unexpected staging path")
        shutil.rmtree(stage)
    # Preserve visual terrain/textures and their metadata byte-for-byte.
    if not args.resume_staging:
        shutil.copytree(live, stage)
    B.OUT = str(stage)
    B.BASELINE_METRIC_RESULTS.clear()
    print("BUILD", B.PERIOD, B.COVERAGE_POLICY, flush=True)
    if not args.resume_staging:
        B.main()
        build_planets.main()
    # V1 uses only existing cache (five original-window instants/site/body).
    # Absence is a hard error, never a reason for automated Horizons bulk calls.
    validate.main(use_horizons=True, cached_only=True)
    baseline = here/"cache"/"year-extension-baseline"
    reg = regression(stage, baseline) if baseline.exists() else {
        "pass": True, "status": "baseline-unavailable",
        "note": "No historical regression is claimed in this invocation."}
    if args.resume_staging:
        previous_report = read(here/"cache"/"rolling-regression.json")
        reg["baselineWindowMetrics"] = previous_report.get("baselineWindowMetrics", [])
        reg["baselineMetricEvidenceNote"] = "Baseline-window metrics were checked during the original generation, not recomputed during staging-only finalization."
    else:
        reg["baselineWindowMetrics"] = list(B.BASELINE_METRIC_RESULTS)
    if not reg["pass"] or not all(r["pass"] for r in B.BASELINE_METRIC_RESULTS):
        raise RuntimeError(f"Original-interval regression failed: {reg}")
    (here/"cache"/"rolling-regression.json").write_text(json.dumps(reg, indent=2)+"\n", encoding="utf-8", newline="\n")
    manifest = read(stage/"manifest.json")
    manifest["provenance"]["generationEnvironment"] = {
        "python": platform.python_version(), "numpy": np.__version__, "spiceypy": spiceypy.__version__,
        "sourceLockFile": "scientific/source-lock.json",
        "sourceLockSha256": B.sha256(here/"source-lock.json"),
        "generatorCodeSha256": {p.name: B.sha256(p) for p in sorted(here.glob("*.py"))},
    }
    manifest["validation"]["externalEphemerisCoverageNote"] = "V1 compares only five cached instants in March-April 2027 for Sun/Earth at six sites. No external ephemeris check of every other date or planet is claimed."
    (stage/"manifest.json").write_text(json.dumps(manifest, indent=1)+"\n", encoding="utf-8", newline="\n")
    hash_dataset.main(stage)
    entries = read(stage/"integrity.json")["files"]
    for item in entries:
        path = stage/item["file"]
        if B.sha256(path) != item["sha256"]:
            raise ValueError(f"Integrity mismatch: {path}")
        if path.stat().st_size >= 25_000_000:
            raise ValueError(f"File exceeds conservative 25 MB hosting limit: {path}")
        if b"\r\n" in path.read_bytes():
            raise ValueError(f"CRLF in scientific JSON: {path}")
    sizes = [{"file": x["file"], "bytes": x["bytes"],
              "gzipBytes": len(gzip.compress((stage/x["file"]).read_bytes(), mtime=0))} for x in entries]
    (here/"cache"/"rolling-sizes.json").write_text(json.dumps(sizes, indent=2)+"\n", encoding="utf-8", newline="\n")
    print("REGRESSION", json.dumps(reg), flush=True)
    print("SIZES", json.dumps(sizes), flush=True)
    if args.output_dir:
        print("Validated output left at", stage, flush=True)
        return
    # Same-volume directory renames promote the complete generation. There is
    # a brief absent-name interval; a failed second rename restores the old set.
    # Never run a server/deploy/copy reading public/data during this promotion.
    os.replace(live, backup)
    try:
        os.replace(stage, live)
    except BaseException:
        os.replace(backup, live)
        raise
    # Retain the prior generation in ignored cache for rollback, not public/.
    prior = here/"cache"/"rolling-previous"
    if prior.exists():
        if (prior.is_symlink() or not prior.resolve().is_relative_to(here.parent.resolve())
                or prior.resolve().parent != (here/"cache").resolve()):
            raise ValueError("Unsafe prior-generation cache path")
        shutil.rmtree(prior)
    os.replace(backup, prior)
    print("PROMOTED", live, flush=True)


if __name__ == "__main__":
    main()
