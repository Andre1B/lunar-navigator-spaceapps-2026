# Scientific pipeline

Offline pipeline that turns public NASA lunar topography and NAIF ephemerides into the static JSON files in `public/data/`. The site never calls a NASA API at run time.

## Run

```bash
cd scientific
pip install -r requirements.txt
./fetch_data.sh                                   # ~520 MB into cache/ (not versioned)
PYTHONPATH=. python -P build_scenes.py            # writes public/data/{manifest,sky}.json and sites/*.json
PYTHONPATH=. python -P validate.py --horizons     # writes public/data/validation.json
PYTHONPATH=. python -P build_planets.py           # optional visual context: public/data/planets.json
PYTHONPATH=. python -P build_globe.py             # globe relief (needs cache/svs/ldem_4.tif from SVS 4720)
PYTHONPATH=. python -P build_terrain_tiles.py     # 20 km local terrain tiles
PYTHONPATH=. python -P build_starmap.py           # star background (needs cache/svs/starmap_2020_4k.exr from SVS 4851; OpenEXR + Pillow)
PYTHONPATH=. python -P build_visual_assets.py     # Moon colour 4k/2k and Earth 2k JPEGs (Pillow, tifffile + imagecodecs)
```

`--horizons` sends 8 serial requests to the JPL Horizons API (one at a time, identifying User-Agent, responses cached in `cache/horizons/`). Omit it to keep V1 pending.

## Method

| Step | What | Source |
| --- | --- | --- |
| Terrain | Nested DEMs: PGDA 5 m site DEM (< 5 km), PDS `LDEM_80S_80M` (5–100 km), PDS `LDEM_75S_240M` (> 100 km, to the edge of coverage). Heights in metres above the 1737.4 km sphere. | [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78), [LOLA polar GDR](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/) |
| Horizon | 720 great-circle sight lines (0.5°), bilinear DEM sampling, exact Cartesian elevation angle from the observer (1 m or 5 m above the surface). Method of Mazarico et al. 2011 / Barker et al. 2021. | `lunar_horizon.py` |
| Ephemeris | SPICE `azlcpo`, `LT+S`, observer fixed in `MOON_ME`. Kernels: `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_250416.tf` (its `MOON_ME` is the DE421 mean-Earth frame used by the DEMs), `pck00011.tpc`, `naif0012.tls`. | `lunar_ephem.py`, [NAIF](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/) |
| Visibility | Fraction of the Sun or Earth disk above the terrain horizon. The disk is cut horizontally at the horizon elevation at the disk-centre azimuth (Barker et al. 2021). Uniform disk, no limb darkening. | `lunar_ephem.disk_fraction` |
| Metrics and events | 5-minute internal grid. Rise and set times are refined by bisection to ≤ 30 s. A longest period that touches the window edge is flagged `censored` (show it as "≥"). | `build_scenes.py` |

Projection: south polar stereographic on the 1737.4 km sphere. Longitude 0 points to +Y and 90° E to +X, following `DSMAP_POLAR.CAT`'s inverse equations. PGDA GeoTIFF tiepoints are pixel corners (PixelIsArea).

## Points of interest

All four sites are on the PGDA 5 m site DEMs. They are points from published LOLA studies, **not NASA-selected landing sites**.

| id | Coordinate source |
| --- | --- |
| connecting-ridge | Centroid of RoI 5, PGDA `Site01_ROIs` |
| shackleton-rim | Centroid of RoI 1, PGDA `Site04_ROIs` |
| nobile-rim-1 | Highest long-term average illumination pixel (PDS `AVGVISIB_85S_060M`) inside the Site06 DEM, at least 6 km from its edges. No RoI file is published for this site. |
| malapert-massif | Same rule, Site23 DEM |

## Validation

See `public/data/validation.json`. Targets are written in `validate.py`. A test that was not executed stays `pending`.

| ID | Check |
| --- | --- |
| V1 | Sun and Earth az/el versus Horizons at 40 sampled instants. Agreement is limited by the 1e-6° precision Horizons prints; it is not a general proof of equality. |
| V2 | Vertical datum and registration, PGDA 5 m versus PDS 80 m |
| V3 | Horizon range convergence |
| V4 | Reproduces the Barker 2021 > 70% illumination class (same period, height and definition) |
| V4b | PGDA 18.6-year map shown side by side (context only, not a pass/fail test) |
| V5 | Height monotonicity, and zero direct sunlight at a permanently shadowed pixel |

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
