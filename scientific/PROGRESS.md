# scientific/ progress

Owner: Claude (agent feb63b33). Model: claude-opus-5-5, configured as medium by Traycer. Scope: `scientific/` and `public/data/` only.

## 2026-11-14

**Done**

- Downloaded the inputs: NAIF kernels plus `earth_latest_high_prec.bpc` (unused), and PDS LDEM 80 m and 240 m, AVGVISIB/LPSR 60 m and PGDA 5 m DEMs for Site01, 04, 06 and 23. All are in `cache/`, which is gitignored.
- The PGDA `Site06_ROIs.tgz` and `Site23_ROIs.tgz` links return HTML with HTTP 200. Those two sites use the max-AVGVISIB rule instead (see README).
- Wrote `lunar_geo.py` (projection, DEM I/O), `lunar_horizon.py`, `lunar_ephem.py`, `build_scenes.py` and `validate.py`.
- `build_scenes.py` takes about 26 s. It covers 4 sites over 2027-03-01 → 2027-04-28, with a 60-minute output step, a 5-minute internal grid and heights of 1 m and 5 m. Output is about 0.7 MB.
- One horizon takes about 1.7 s per site, measured at Site01 for both heights.
- Eclipse screening found none in the period.
- `validate.py --horizons` made 8 new Horizons requests, which are cached. Results:

  | Test | Result |
  | --- | --- |
  | V1 | pass. Separation ≤ 1e-6°, the Horizons print precision. |
  | V2 | pass. Median offset 0.20–0.27 m, best shift (0, 0). The target was written after an exploratory run; the notes say so. |
  | V3 | pass. 0.000° change when truncating at 300 km. |
  | V4 | pass. 0.783 for connecting-ridge and 0.708 for shackleton-rim, against a target above 0.70. |
  | V4b | info. |
  | V5 | pass. PSR pixel max fraction is 0. |

**Next**

- Independent review of the pipeline and data contract, requested from the coordinator.
- Add custom-coordinate support (P1) only if the coordinator asks.

## Commands

```bash
PYTHONPATH=. python -P build_scenes.py
PYTHONPATH=. python -P validate.py --horizons
```

## 2026-11-14 (later)

- V1 wording: agreement is limited to the 40 sampled instants and to Horizons' printed precision. It is not a general equality. Added to validate.py notes and README.
- `sky.json` now has an `earthOrientationNote`: IAU_EARTH low-precision model, visual only, not validated.
- V2 note still states that its target was written after an exploratory run.
- Read-only review of the frontend (`src/lib/analysis.mjs`, `src/components/SpaceScene.jsx`, `Horizon.jsx`) sent to the coordinator. No frontend files edited.
- Pinned requirements.txt to numpy 2.5.3, spiceypy 8.4.0 (CSPICE N0067) and tifffile 2026.9.20. pyshp is optional and not imported. Pillow is NOT used.
- Reviewed the second SpaceScene revision and eventSummary (read-only) and sent the exact credits list to the coordinator.
