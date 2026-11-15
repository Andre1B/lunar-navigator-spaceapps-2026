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


## 2026-11-14 ? five observer heights (Sol medium, no commit)

Accepted contract: 0.5, 1, 2, 5, 10 m above the DEM surface; separately calculated horizons, observer positions, visible fractions, refined events and metrics at every height. Shared geometry arrays explicitly retain the 1 m reference. The period, source inputs and sampling/refinement methods are unchanged. Low-height sensitivity is disclosed; 0.5 m is not a terrain accuracy claim.

- `python -u build_scenes.py`: exit 0, four sites generated.
- `python -u validate.py --horizons`: exit 0; V1/V2/V3/V4/V5 pass, V4b informational. V5 checks unrounded horizons and generated hourly Sun/Earth fractions for all four adjacent height pairs at every site, plus the existing PSR check.
- Regression against the pre-generation snapshot at `scientific/cache/height-baseline/` (ignored): restricting each site document to its original 1/5 m horizon, fractions, metrics and events yields the entire original compact JSON byte for byte; all four sites pass. `sky.json` also byte-identical. No original numeric values changed.
- `python scientific/hash_dataset.py`, then `npm run check:data`: 8/8 files verified. Changed JSON files contain no CRLF.
- Four site files: 505471 -> 734501 bytes total (uncompressed).
- `npm run build` passed (existing large-chunk warning); `npm run credits` verified 163 package records, zero missing repository URLs. Its generated timestamp-only diff was reverted.
- Existing `npm test` after hashing: 122 pass / 6 fail. Five failures hardcode the old [1,5] height contract. One event test incorrectly assumes no second transition before the next hourly sample: Connecting ridge at 2 m on March 3 sets at 15:02:39, rises at 15:25:28, and sets at 17:10:28, so 16:00 legitimately has a visible fraction of 0.003. Independent tests owner notified to update the contract and test the intervening event sequence; no tolerance relaxation requested. Updated independent tests remain pending at this checkpoint.

Frontend, root configuration, docs and deploy belong to coordinator c7a52caa; only scientific/ and public/data/ are included in this handoff. No commit or deploy performed. Production, keyboard, reduced-motion and Lighthouse checks belong to the integration/QA stage and were not claimed for this dataset change.


## 2026-11-14 local / 2026-11-15 UTC ? two independently calculated neighbors

Root accepted the coordinate contract before generation: `connecting-neighbor` = original Connecting point +1000 m in polar-stereographic X (Site01), and `shackleton-neighbor` = original Shackleton point +1000 m in polar-stereographic Y (Site04). Offsets were fixed before examining visibility results. They are our selections, not published RoI centroids, illumination optima, selected landing sites or mission recommendations. Both have >6 km source-tile edge margin; all five heights and the existing period/method are retained.

`build_scenes.py`, `build_terrain_tiles.py`, `validate.py --horizons`, `hash_dataset.py` all exited 0. V1 passes 60 sampled site/body/instant directions (four new serial Horizons queries); V2 passes the four unique source DEMs; V3 passes six points; V4 remains two original published RoI centroids; V4b is informational for six; V5 passes all six points and the original PSR control. No claim of external validation at every instant.

Regression against ignored `scientific/cache/sites-six-baseline/`: original four complete site JSON files, `sky.json`, and four original terrain binaries are byte-identical. Original manifest site entries and terrain metadata entries are equal. Added two 500000-byte visual tiles; visual data remain separate from the scientific horizons. `npm run check:data` verifies all 10 core files; changed JSON uses LF. No frontend edit, build, credits, commit or deploy was performed. Independent tests owner notified to parameterize manifest counts and retain the original baseline checks; browser/production checks remain with QA/root.


## 2026-11-15 UTC - rolling calendar coverage and geometric solar eclipses (in progress)

Coordinator accepted one calendar year before and after the current UTC date, using February 29 -> February 28 on non-leap anniversaries. Clock read 2026-11-15; requested coverage is 2025-11-15T00:00:00Z through 2027-11-15T00:00:00Z (730 days, 17,521 hourly samples, 210,241 five-minute endpoints). All six sites and five observer heights remain independently calculated, with shared geometry explicitly at 1 m. The original six-site/sky/planet dataset was saved in ignored `scientific/cache/year-extension-baseline/` before generation.

`coverage.py` provides reproducible --as-of or --start/--end; `rebuild.py` stages a complete dataset, validates it, compares the historical interval by UTC offsets, hashes all ten core files and promotes the directory with rollback. `fetch_sources.py` checks or downloads only pinned static source files. Source lock contains 17 kernel/DEM/label inputs and 12 bundled historical Horizons response fixtures (97,968 bytes); no new Horizons request was made. Fixtures were audited for local paths, personal request identifiers and authorization/credentials; only public jpl.nasa.gov contact domains occur.

`lunar_eclipse.py` implements an angular-circle approximation: opaque spherical Earth, uniform Sun, joint disk area above the existing horizontal terrain cut and outside Earth. It does not multiply independent terrain/eclipse fractions or interpret an occultation flag as a partial fraction. Solar terrain-only and eclipse-only fractions are separately retained. Site/height-specific eclipse contacts are separate events; full eclipse darkness changes receive explicit eclipseDarknessStart/End event types. No atmosphere, refraction, limb darkening, energy or photometry is claimed.

Pre-generation V6 numeric targets were fixed in code: analytic error <1e-8, 128/256 quadrature convergence <2e-5, independent 100,000-chord midpoint integral error <1e-4. The 86 cases pass (0; 3.35851e-8; 4.63616e-8 respectively). A geometric solar-cap containment branch prevents spurious residual sunlight when Earth covers all of the terrain-visible cap before covering the entire Sun. Calendar/leap-day CLI checks and static source-lock probe passed. The public dataset is still the old set while generation/acceptance remains in staging.

Final metrics explicitly use N-1 left-endpoint five-minute intervals, excluding the terminal endpoint from durations and means. Historical metrics are reproduced with the previous N-endpoint convention solely to verify the saved original interval. V1 remains limited to the five cached March-April 2027 instants for six sites and two bodies; expanded dates/planets/eclipses do not gain a new external-validation claim.


### Rolling dataset acceptance checkpoint, 2026-11-15 02:42 UTC

All six sites, hourly sky and seven visual planets are generated. V1/V2/V3/V4/V5/V6/V7 pass; V4b is informational. V1 made zero new Horizons requests and remains limited to the sixty original-window site/body/instant comparisons. V7 confirms the 17,521-sample coverage, finite bounded fractions, joint fraction inequalities, contact/event bounds and durations bounded by 17,520 hours. Original interval regression passes at hourly offset 11,304 for 1,393 samples: all six horizons/geometry/fractions/events and sky/planet arrays are numerically identical. All thirty old-window metric comparisons pass under the historical endpoint convention.

The first finalization was blocked by CRLF from Windows Path.write_text. Explicit LF was fixed; --resume-staging rechecked unchanged numerical-module hashes and all sources, reran V1-V7 and regression, and verified all ten final SHA-256 entries. No numerical generation needed repeating for this serialization fix. Staged core files total 23,484,309 bytes; sum of independent gzip encodings is 5,108,586 bytes. Largest file planets.json is 4,724,832 bytes; largest site is 2,703,976 bytes, below the conservative 25 MB/file check.

Promotion is currently blocked by Windows WinError 5 (Access denied) renaming public/data to public/.data-previous, consistent with an open reader/watcher handle. This is not a scientific failure: final validated set is intact in ignored cache/rolling-staging. Independently rechecked that all eleven baseline live files are still byte-identical. Coordinator was asked to free its reader handles or authorize a controlled copy while build/deploy is paused. No unrelated agent process was stopped. Integration/QA is not marked complete.


### Rolling dataset promoted and stable, 2026-11-15 02:44 UTC

Coordinator stopped only its own Vite server to free the Windows directory handle. Retrying directory promotion then succeeded immediately: complete prior public/data moved to ignored cache/rolling-previous-20261115, and the validated staging directory became public/data. No controlled-copy fallback was needed and no other agent process was stopped. Reverified all ten SHA-256 entries in the public directory after promotion; the manifest/source-lock hash and all eighteen generator-code hashes also match the current scientific sources. Scientific data are now stable; root and independent QA owner were notified to restart their server and proceed.

Final public coverage is 2025-11-15T00:00:00Z through 2027-11-15T00:00:00Z, hourly inclusive, six points times five independently calculated heights. V1-V7 pass, V4b info. Core total is 23,484,309 bytes raw and 5,108,586 gzip (sum of separately compressed files); planets is the largest at 4,724,832 bytes. Historical baseline numerical arrays/events/horizons/sky/planets and thirty historical metrics pass as documented above. Three geometric eclipse intervals per observer height are present at each point, with site-specific contacts and explicit assumptions; no claim of full external validation of the expanded dates, atmosphere, energy or photometry is made.

The direct generation command was python -u rebuild.py --as-of 2026-11-15. Finalization after LF correction used the same command with --resume-staging; it passed all checks and was blocked only by the local Vite handle. A check-preserving directory-only promotion then completed after the handle was released. Fresh automated runs can use python fetch_sources.py followed by python -u rebuild.py; no Horizons requests are made. Local readers/watchers must be stopped before directory promotion. PROGRESS and README were closed after data stability; no frontend/tests/deploy/build/credits/commit were performed by this agent.


### Reviewed P2 event-cause correction; stable again at 2026-11-15 02:50:24 UTC

Independent review found that the former midpoint test (terrain fraction positive and disks overlapping) could misclassify a terrain sunrise/sunset as eclipse darkness. Corrected the generator to inspect terrain-only visibility at both final bracket endpoints. A terrain transition retains sunrise/sunset; an Earth-only counterfactual transition requires terrain visibility at both endpoints. Twenty terrain-cap variants and two Earth-only cases pass before postprocessing.

Executed python -u refine_event_metadata.py, exit 0 (~30 seconds). It reproduced 82 near-eclipse solar event brackets and required every UTC timestamp to match exactly. Two real labels changed: connecting-ridge at 0.5 m, 2026-03-03T09:59:32Z, eclipseDarknessEnd -> sunrise/terrain; shackleton-rim at 10 m, 2026-03-03T13:04:51Z, eclipseDarknessStart -> sunset/terrain. Exhaustive object equality proves all series, fractions, metrics, horizons, intervals and UTC timestamps unchanged. Only event type/cause and new refinementBracketSec metadata differ. The actual numerical bracket is 18.75 seconds; resolutionMin=1 is conservative reporting, not physical accuracy.

V6 remains passed, V7 now includes the 22 counterexamples and per-event refinementBracketSec >0 and <=30 checks, and original-window regression passes. Validation and manifest record the correction, the generator source hashes are updated, and all ten core hashes were reverified after directory promotion. Root and QA were notified stable again; no further science/data edit is planned. Current core byte count is recorded by integrity.json (slightly larger than the preceding pre-metadata size checkpoint). Final public code/reference files have no credentials or personal paths. The separate research checkpoint docs/WINNER-ROUND-REPORTS.md was normalized to ASCII punctuation only, preserving its evidence and pending status.


### Exact source restoration after reboot/security removal - 2026-11-15T03:08:01Z

Three final source files were missing: build_scenes.py, validate.py and refine_event_metadata.py. No direct final source backup was found in VS Code history or the epic content-addressed store. Reconstructed private candidates from this agent's persisted Codex JSONL tool transcript, replaying only recorded source-text transformations on temporary copies. The historical Git base was used solely as reconstruction input; no old HEAD source was accepted directly. All three candidates matched the SHA-256 values recorded by the accepted final public manifest exactly before restoration.

- build_scenes.py: 8dc4071d9a85125569c065b819909d0d9de2d778353414b79f54716dcc060f4e (22044 bytes), exact final-manifest match.
- validate.py: 1be1b01dfbcb151792285bfa9cd45ca75e1e5fd8a6b1de5580d499dcdaaaa55c (16736 bytes), exact final-manifest match.
- refine_event_metadata.py: 70c8034eb3882862f6fb1d0ec6a3eb64d0620f1e1054495a6cfddb887bd81314 (6798 bytes), exact final-manifest match.

Restored only those three scientific sources. In-memory Python 3.12 compilation passed for all three (no imports, generator, data processing or pyc writes). All ten dataset hashes were checked before and after restoration and are unchanged. All 19 generator source hashes recorded in the manifest now match the existing sources. Private recovery evidence is in epic tmp/scientific-source-recovery/restoration-result.json. No data, frontend, tests, deploy, build or commit was changed/run. Python was available through its Windows registry ExecutablePath despite being absent from PATH.
