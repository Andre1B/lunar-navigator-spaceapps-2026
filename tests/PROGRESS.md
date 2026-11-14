# Test agent progress (tests/ only)

Last run: `npm test` -> 0 fail, 0 todo (windowBounds fix verified).

## Files
- `analysis.test.mjs` — `src/lib/analysis.mjs`: timeAt/indexAt, windowBounds (limits, delay, finer step, invalid input), runs (censoring), summarize (hand-computed trapezoid mean / sunlit fraction / dark run / nulls), visibleDiskFraction (analytic circular segment, symmetry, scale invariance, monotonic, invalid), horizonAt (interpolation, wrap, negative azimuth, 720 samples), formatters.
- `dataset.test.mjs` — `public/data`: 4 sites, 1393 hourly samples, heights 1/5 m, fractions in [0,1], sun/earth ranges and angular radius vs range, UTC period/step, conventions and provenance (sha256, URLs), polar-stereographic XY vs lat/lon, horizon 720 x 0.5 deg and 5 m <= 1 m, 5 m visibility >= 1 m, stored visibleFraction recomputed from el/horizon/radius (<0.01), events (window, types, ordering, alternation, no contradiction with the hourly series), metrics vs independent hourly recomputation, sky.json (unit quaternions, continuity, radii), validation.json (schema, statuses, evidence, targets re-checked, manifest summary/status consistency, evidence names an existing function in validate.py).

## Findings for the owner to fix
1. (FIXED, regression test active) windowBounds threw RangeError on an unparsable date.

## Observations (not failures)
- Reproducibility (see below): data is deterministic.
- Hourly series cannot resolve sub-hour sunlit blips (e.g. connecting-ridge 2027-03-19T11:32Z at 1 m, malapert 2027-04-09T16:19Z at 5 m). Tests therefore only require events not to contradict the hourly samples; hourly vs 5-min "longest dark" differ by up to 4.1 h (malapert 5 m: 143.92 h vs 148 h hourly). Worth noting in UI copy that metrics come from the 5-min grid, not the hourly series.
- `scientific/build_scenes.py` hard-codes `OUT=../public/data`; there is no output-directory option, so reproducing needs a copy of `scientific/` next to a scratch `public/data`. Suggest an env var / `--out`.

## Reproducibility check (done outside the repo, nothing in public/data touched)
Scratch copy: `scientific/*.py` copied, `cache/{dem,kernels,roi}` junctioned read-only, `cache/horizons` copied (no network use), output to scratch `public/data`. Ran `build_scenes.py` (27 s) and `validate.py --horizons` (31 s).
SHA-256 before/after: `sky.json` and all four `sites/*.json` byte-identical. `manifest.json` and `validation.json` differ only in `generatedAtUtc` (verified with `diff`). Conclusion: pipeline output reproducible from the cached inputs. Not checked: re-downloading inputs (`fetch_data.sh`) and V1 against a fresh Horizons response (cache used).
