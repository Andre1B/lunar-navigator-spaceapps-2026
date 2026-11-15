# Scientific pipeline

Offline pipeline that turns public NASA lunar topography and NAIF ephemerides into the static JSON files in `public/data/`. The site never calls a NASA API at run time.

## Run

```bash
cd scientific
pip install -r requirements.txt
python fetch_sources.py                          # pinned core inputs only; downloads missing/changed sources
python fetch_sources.py --check-only             # probe cache + bundled reference hashes, no network
python -u rebuild.py --as-of 2026-11-15          # all series, validation, hashes, final directory promotion
python -u rebuild.py                            # current UTC date, one calendar year each side
python -u rebuild.py --start 2027-03-01 --end 2028-03-01 --output-dir cache/custom-run
# Individual generators accept --as-of or --start/--end and --output-dir;
# use them only in an isolated output directory. rebuild.py coordinates a complete set.
PYTHONPATH=. python -P build_globe.py             # globe relief (needs cache/svs/ldem_4.tif from SVS 4720)
PYTHONPATH=. python -P build_terrain_tiles.py     # 20 km local terrain tiles
PYTHONPATH=. python -P build_starmap.py           # star background (needs cache/svs/starmap_2020_4k.exr from SVS 4851; OpenEXR + Pillow)
PYTHONPATH=. python -P build_visual_assets.py     # Moon colour 4k/2k and Earth 4k/2k JPEGs (Pillow, tifffile + imagecodecs)
PYTHONPATH=. python -P build_earth_layers.py      # illustrative Earth clouds + ocean specular (Solar System Scope, CC BY 4.0)
PYTHONPATH=. python -P build_mobile_textures.py   # 1024x512 mobile variants from the 2k files
```

`rebuild.py` never calls Horizons: it uses the existing cache or the twelve bundled historical reference responses and fails if both are missing. Manual `validate.py --horizons` can query missing entries serially, with identifying User-Agent; the six-site reference set has 12 site/body requests, five instants each. V1 covers March-April 2027 only, not the rest of rolling coverage or the planets. Omitting `--horizons` in a manual run leaves V1 pending.

All cached kernels, DEMs and auxiliary validation maps must match `source-lock.json` before generation. The manifest records their hashes, source URLs, the generator-code hashes and Python/NumPy/SpiceyPy versions. A daily run does not silently update source files. Cache acquisition and the external daily deployment workflow are separate responsibilities.

## Method

| Step | What | Source |
| --- | --- | --- |
| Terrain | Nested DEMs: PGDA 5 m site DEM (< 5 km), PDS `LDEM_80S_80M` (5–100 km), PDS `LDEM_75S_240M` (> 100 km, to the edge of coverage). Heights in metres above the 1737.4 km sphere. | [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78), [LOLA polar GDR](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/) |
| Horizon | 720 great-circle sight lines (0.5°), bilinear DEM sampling, exact Cartesian elevation angle from the observer (0.5, 1, 2, 5 or 10 m above the surface). Method of Mazarico et al. 2011 / Barker et al. 2021. | `lunar_horizon.py` |
| Ephemeris | SPICE `azlcpo`, `LT+S`, observer fixed in `MOON_ME`. Kernels: `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` (its `MOON_ME` is the DE421 mean-Earth frame used by the DEMs), `pck00011.tpc`, `naif0012.tls`. | `lunar_ephem.py`, [NAIF](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/) |
| Visibility | Fraction of the Sun or Earth disk above the horizontal terrain cut at disk-centre azimuth (Barker et al. 2021). Solar fractions jointly exclude the opaque spherical Earth; terrain-only and eclipse-only fractions are also published. Uniform disks, no limb darkening. | `lunar_ephem.disk_fraction`, `lunar_eclipse.py` |
| Metrics and events | 5-minute internal grid. Rise and set times are refined by bisection to ≤ 30 s. A longest period that touches the window edge is flagged `censored` (show it as "≥"). | `build_scenes.py` |

Projection: south polar stereographic on the 1737.4 km sphere. Longitude 0 points to +Y and 90° E to +X, following `DSMAP_POLAR.CAT`'s inverse equations. PGDA GeoTIFF tiepoints are pixel corners (PixelIsArea).

## Points of interest

All six points are on the cached PGDA 5 m site DEMs. Four original points come from published LOLA study products. Two neighbors were selected by our team using fixed coordinate offsets, not by optimizing illumination. **None are NASA-selected landing sites.**

| id | Coordinate source |
| --- | --- |
| connecting-ridge | Centroid of RoI 5, PGDA `Site01_ROIs` |
| shackleton-rim | Centroid of RoI 1, PGDA `Site04_ROIs` |
| nobile-rim-1 | Highest long-term average illumination pixel (PDS `AVGVISIB_85S_060M`) inside the Site06 DEM, at least 6 km from its edges. No RoI file is published for this site. |
| malapert-massif | Same rule, Site23 DEM |
| connecting-neighbor | Our selection: +1000 m in polar-stereographic X from connecting-ridge; same Site01 DEM |
| shackleton-neighbor | Our selection: +1000 m in polar-stereographic Y from shackleton-rim; same Site04 DEM |

## Validation

See `public/data/validation.json`. Targets are written in `validate.py`. A test that was not executed stays `pending`.

| ID | Check |
| --- | --- |
| V1 | Sun and Earth az/el versus Horizons at 60 sampled site/body/instant combinations (six sites, two bodies, five times). Agreement is limited by the 1e-6° precision Horizons prints; it is not a general proof of equality. |
| V2 | Vertical datum and registration, PGDA 5 m versus PDS 80 m |
| V3 | Horizon range convergence |
| V4 | Reproduces the Barker 2021 > 70% illumination class (same period, height and definition) |
| V4b | PGDA 18.6-year map shown side by side (context only, not a pass/fail test) |
| V5 | Horizon and generated terrain-only Sun/Earth fraction monotonicity for all adjacent height pairs (eclipse parallax excluded), and zero direct sunlight at a permanently shadowed pixel |

| V6 | Joint angular-disk integration: analytical cases, 128/256-order quadrature convergence and independent 100,000-chord midpoint integration |
| V7 | Coverage/count consistency, bounded finite fractions, joint solar fraction no greater than either individual constraint, event/contact bounds and maximum durations |

## Limitations

- Geometry only. No power, battery, thermal, link budget (DSN), landing safety or hazard assessment.
- Earth visibility is line of sight only. It does not guarantee communication.
- Windows shorter than 5 minutes may be missed.
- Only the period stated in `manifest.json` is computed.
- No limb darkening. Boulders and sub-pixel relief are not modelled.

## References

- Mazarico, E. et al. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus* 211, 1066–1081. doi:10.1016/j.icarus.2010.10.030
- Barker, M. K. et al. (2021). Improved LOLA elevation maps for south pole landing sites: error estimates and their impact on illumination conditions. *Planetary and Space Science* 203, 105119. doi:10.1016/j.pss.2020.105119
- Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. *Planetary and Space Science* 44, 65–70 (SPICE).
- SpiceyPy: Annex, A. M. et al. (2020). *JOSS* 5(50), 2050. MIT license. https://github.com/AndrewAnnex/SpiceyPy

## AI use

This code was written with AI coding assistants (Claude Opus 5.5, reviewed with Codex). Every number in `public/data/` is computed by this code from the sources above. No value was produced or edited by a language model.

## Observer height contract

`manifest.observerHeightsM` lists `[0.5, 1, 2, 5, 10]` metres above the DEM surface. Each height has a separately calculated horizon, Sun/Earth visible fraction, events and metrics; heights are never interpolated. Shared `azDeg`, `elDeg`, `rangeKm` and `angularRadiusDeg` arrays retain the explicit 1 m reference (`manifest.conventions.geometryReferenceHeightM`), preserving the original geometry. Visibility calculations use the actual observer position at each height.

A model observer at 0.5 m does not imply terrain accuracy of 0.5 m. The 5 m DEM omits boulders and subpixel relief, and low observer heights are particularly sensitive to terrain error. Zero height is omitted because the model cannot resolve surface contact and subpixel obstacles.

The two neighbor offsets are defined in map axes, not local east/north. Each has independently computed horizons and observer ephemerides at every supported height, plus its own visual terrain tile. V4 remains a reproduction check only for the two original published RoI centroids; it is not extended to the neighbors. Source-DEM datum/registration checks remain at the four unique source tiles.


## Rolling calendar coverage and atomic promotion

The default is one calendar year before and one calendar year after the current **UTC date**, bounded at 00:00:00 UTC. `--as-of YYYY-MM-DD` fixes that date reproducibly; `--start YYYY-MM-DD --end YYYY-MM-DD` overrides the interval explicitly. February 29 anniversaries clamp to February 28 in non-leap years. Both endpoints are stored in hourly arrays. `coveragePolicy` in the manifest records the exact mode/date and policy. On 2026-11-15 the window is 2025-11-15 through 2027-11-15: **730 days, 17,521 hourly samples**, and 210,241 internal five-minute endpoints. There is no automatic browser fetch or runtime extension.

Daily scheduling/deployment is external. Each run fully recomputes the requested window from pinned inputs; when the UTC date advances, the oldest day falls out and the new final day is added. `rebuild.py` first copies the current visual assets to an ignored staging directory, generates all six sites, sky and seven visual planets there, validates them, checks historical regression when the baseline is available, and writes/verifies all ten core SHA-256 entries. It rejects a core file of 25,000,000 bytes or larger and checks LF JSON. After all checks pass it promotes the entire directory with same-volume renames and rollback on failure. There is a brief gap between the two renames; no build, deploy or file reader should run concurrently. The prior set is retained in ignored cache. An explicit `--output-dir` leaves a validated set there without promoting it.

Historical regression uses timestamps, not assumed prefix offsets. When the saved March 1-April 28, 2027 baseline lies inside the new interval, all six original horizons, hourly Sun/Earth geometry and fractions, events, sky vectors/orientations and planet positions must match exactly. Metrics are separately recomputed over that old interval using the old endpoint-average convention and must reproduce the saved values. Missing/nonoverlapping baseline is explicitly recorded; it is not a historical regression pass.

**Terminal endpoint correction:** the old short-window metrics averaged/count all N five-minute endpoints. A stay has N-1 time cells. Current published metrics use the N-1 left-endpoint cells, excluding the final endpoint from averages and duration counts. Thus a duration never exceeds the actual interval by an extra five minutes. Historical metric reproduction deliberately retains the former convention only for the baseline check. Annual/two-year metric values differ from short-window values because the interval differs and because this endpoint convention is now explicit. This is a five-minute-grid numerical approximation, not integration at arbitrary sub-minute times.

## Solar eclipses: model and output contract

`lunar_eclipse.py` models an opaque spherical Earth of radius 6378.137 km against a uniform Sun of radius 696000 km. Both apparent local directions and angular radii come from the same site/height SPICE observer (`LT+S`). It screens every internal and output sample by angular limb separation, not a binary centre-of-Moon occultation flag. The [NAIF occultation documentation](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/occult_c.html) defines classification rather than a partial disk area; the generator does not substitute an occultation code for a fractional eclipse.

In local north/east/up coordinates let s and e be the Sun/Earth unit directions. At the Sun, right is (-sin az, cos az, 0) and up is (-sin el cos az, -sin el sin az, cos el). Earth projects to (x0,y0)=(dot(e,right),dot(e,up)), rho=hypot(x0,y0), separation=atan2(rho,dot(s,e)). The angular-plane Earth centre is (cx,cy)=(x0,y0)*separation/rho, converted to degrees. At coincident centres use (0,0). Solar and Earth angular radii are asin(physical radius / observer range).

The solar circle has radius r, the Earth circle R and centre (cx,cy), and the terrain is the horizontal cut y=horizon(solar azimuth) minus solar elevation. `visible_fraction` integrates the solar area that is **both** above this cut and outside Earth, divided by pi*r^2. It integrates horizontal chord intersections with 128-point Gauss-Legendre quadrature, split at circle intersections/extrema. Exact no-overlap and containment branches prevent artificial residual light in total occultation. This angular-circle tangent-plane approximation is consistent with the existing local horizontal terrain cut but does not model the Earth's ellipsoidal limb. The spherical-Earth assumption can shift contact times or fractions relative to an ellipsoidal calculation; the reported <=30-second bisection is numerical resolution, not a claim of physical contact-time accuracy.

For each height, `sun.visibleFraction` is the joint result; `sun.terrainVisibleFraction` ignores Earth; `sun.eclipseUnobscuredFraction` ignores terrain. **The last two fractions must not be multiplied**: their blocked areas can overlap. Earth visible fractions continue to describe geometric terrain line of sight only.

`eclipses` contains site/height-specific intervals, refined contact timestamps, edge-censor flags and the minimum unobscured solar fraction on the five-minute grid. `eclipseEvents` separately contains `solarEclipseStart` and `solarEclipseEnd` contacts. Existing terrain rise/set events retain their names; if full Earth occultation creates a direct-sun transition above the terrain, `events` uses `eclipseDarknessStart` or `eclipseDarknessEnd` with cause `earth-occultation`. Sun fractions, time-fraction metrics, means and darkness durations all use the same joint calculation. A partial eclipse with any solar area still visible does not become total darkness.

This is geometric direct-disk visibility: **no atmosphere, refraction, limb darkening, atmospheric penumbral transmission, solar irradiance, battery, energy or perceived-brightness model**. Earth illumination/phase and communications are not derived from its geometric visibility. V6 validates the numerical angular-area integral, not those omitted phenomena or independent eclipse ephemerides. Visual terrain brightness remains illustrative.

The twelve historical Horizons responses total 97,968 bytes and are bundled under `scientific/reference/horizons/`. `fetch_sources.py` verifies these fixtures and 17 pinned cache files (including four PDS labels); it fetches only static NASA/NAIF inputs missing from cache, using serial HTTPS transfers and rejecting hash mismatches before replacement. It never requests new Horizons data. Reference fixtures were audited for local paths, credentials and personal request identifiers before inclusion.

`--resume-staging` can finalize an interrupted generation with the same coverage without recalculating it. It requires a staged manifest with matching hashes of all numerical generation modules, rechecks source locks, reruns validation and regression, then hashes and promotes. Historical metric checks retained from the original generation are labeled as such.


## Solar event cause classification and numerical refinement

During a solar eclipse, disk overlap alone does not establish that Earth caused a light/dark transition. The generator evaluates terrain-only visibility at the two ends of the final refined bracket. If terrain visibility changes, the event remains sunrise/sunset with cause terrain. If both bracket ends already have terrain visibility and only the joint result changes, the event is eclipseDarknessStart/End with cause earth-occultation. These are counterfactual geometric labels, not photometry.

`events` and `eclipseEvents` publish `refinementBracketSec`, the actual numerical bracket after bisection. Starting from 300 seconds and halving until at most 30 seconds gives 18.75 seconds in this dataset. `resolutionMin:1` is the conservative reported resolution, not the original five-minute search step or a physical contact-time accuracy claim. V7 checks the bracket bound and 22 cause-classification cases, including the reviewed example where a high solar cap emerges unblocked while Earth overlaps only the lower Sun.

`python -u refine_event_metadata.py` is a reproducible, narrow correction for an existing generated dataset. With local readers stopped, it reproduces solar brackets near eclipses using the same pinned DEMs and SPICE model, requires stored UTC timestamps to match exactly, and proves every numerical series/metric/horizon/interval remains equal. Only type/cause and refinement metadata may change. It reruns V6/V7 and historical regression, writes explicit correction evidence, updates provenance and ten core hashes, and promotes a complete directory with rollback. The correction on 2026-11-15 reproduced 82 brackets and changed two cause labels; details are in validation.eventMetadataCorrection and manifest.provenance.eventMetadataCorrection.
