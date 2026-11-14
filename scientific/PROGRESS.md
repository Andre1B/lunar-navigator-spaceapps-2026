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
- Added build_planets.py, which writes public/data/planets.json (375 KB). It has 7 planets over the same period: Moon-centred J2000 positions with LT+S, PCK mean radii, and system barycentres labelled as proxies for Mars through Neptune. Visual only and not validated against Horizons.
- Added public/demo/ (index.html, demo.css, demo.js): six slides in English. External JS because the CSP is script-src self. Checked in the headless preview: slide 1 and slide 4 at 1280x720, slide 5 at 390x844, no console errors. No screenshots of the app were embedded.
- Demo revision. Slide 3 now uses a real app screenshot: tmp/lunar-qa/desktop-compare.png cropped to the Compare section, with the footer logo excluded, saved as public/demo/app-comparison.png (77 KB) and labelled "Screenshot of the live app, cropped".
- Slide 2 no longer claims existing tools are slow, which we never measured. It now states our focus.
- V1 and V2 caveats are kept as footnotes on slide 5.
- Visible text is about 455 words.
- Preview at 1280x720 and 390x844 showed no overflow. The only console error is a 404 for /icon.svg, which is absent in the preview sandbox but present on the site.
- Added build_globe.py for the global relief. Source is the NASA SVS CGI Moon Kit ldem_4.tif (4 MB, cached). Outputs in public/data/globe/: moon-elevation-1440x720.i16 (2.07 MB, 1.8 MB gzip), moon-elevation-720x360.i16 (0.52 MB) and moon-elevation.json. Format is int16 LE metres above 1737.4 km, at true scale. Orientation was checked against PDS LDEM_80S_80M: median 0.5 m, median absolute 32 m (resolution); a +/-1 deg longitude shift is clearly worse. The SVS page has maps only, no 3D model files.
- Terrain tiles: build_terrain_tiles.py writes public/data/terrain/ with 4 files of 500x500 int16 (500 KB each) and terrain.json. Each tile covers 20 km at 40 m; cells are 8x8 means of the PGDA 5 m DEM, otherwise LDEM_80S_80M; 64-79% of cells come from PGDA. The four centre cells match the site height within 3 m.
- Star map: build_starmap.py converts SVS 4851 starmap_2020_4k.exr (36 MB, cached) to sRGB JPEGs at 4096 (2.2 MB) and 2048 (0.43 MB), plus starmap.json. Brightness is labelled illustrative. Orientation checked: the Galactic centre and the LMC sit at their expected RA/Dec. This uses OpenEXR and Pillow, both optional.
- Visual textures: build_visual_assets.py writes globe/moon-color-lroc-4096x2048.jpg (2.06 MB) and -2048x1024.jpg (0.53 MB) from SVS lroc_color_16bit_srgb_4k.tif (62 MB, cached), and globe/earth-visual-2k.jpg (0.35 MB) from public/assets/earth-blue-marble-2004-03.png (read only), plus globe/visual-assets.json. Moon orientation checked: Mare Crisium and Tycho are in place. No normal map; the root computes normals from geometry.
- Polar striping diagnosis. The raw equirectangular grids give false east-west slopes near the poles, up to 19 at 89.9 S, because column spacing is metres while row spacing is km. build_globe.py now also writes moon-elevation-{1440x720,720x360}-isotropic.i16: each row is box-averaged over round(1/cos lat) columns. Polar slopes become 0.05-0.2, matching the equator; equatorial rows are unchanged. Physical-normal formula documented in moon-elevation.json. Read-only co-review of sceneGeometry.mjs and SpaceSceneV2.jsx sent.
- Acceptance via reconstruction, no API calls. A Node script outside the repo imported src/lib/sceneGeometry.mjs and three 0.187 and rebuilt the sky-view local frame (uBody/eBody/nBody, quaternion, camera at terrain + 1 m) for 4 sites, every 7th sample (1592 comparisons). Its Sun and Earth directions match sites/*.json az/el within 0.0007 deg max, which is the 0.001 deg JSON rounding.
- Earth 4k: build_visual_assets.py also writes globe/earth-visual-4k.jpg (4096x2048, 1.2 MB, q90) from the same Blue Marble PNG; the 2k stays. visual-assets.json updated with hashes and grid. Cloud texture: the NASA Visible Earth page now redirects to Earth Observatory, so no cloud texture was added.
- Earth layers: build_earth_layers.py writes globe/earth-clouds-illustrative-2k.jpg (0.66 MB, greyscale) and earth-ocean-specular-2k.jpg (0.18 MB, greyscale), plus earth-layers.json, from Solar System Scope 2k textures (CC BY 4.0; cached in cache/sss). Clouds are labelled a fixed illustrative pattern, not weather. Orientation: the specular water mask vs the Blue Marble ocean correlates 0.913 at shift 0 and about 0.27-0.31 at the other shifts. The ground colour stays NASA Blue Marble.
- Mobile textures: build_mobile_textures.py makes 1024x512 Lanczos variants (moon colour, earth ground, clouds, specular, starmap) from the local 2k files, plus globe/mobile-textures.json (parents, hashes). Requested for the 148 ms texture-upload bottleneck on mobile.
- Winners study: tmp/winners-study-2026-11-14.txt covers 4 global winners cloned without execution (Spacebee 2023, QuakeHeroes 2024, Connected Earth 2024, PureFlow 2025). Correction found: the earlier notes on Connected Earth read 2025 rewrite files, not the judged commit e2fc8e0.
- integrity: hash_dataset.py (stdlib only) writes public/data/integrity.json with the SHA-256 of manifest, sky, planets, validation and the 4 site files as they are now, plus manifestGeneratedAtUtc. No data was regenerated.
