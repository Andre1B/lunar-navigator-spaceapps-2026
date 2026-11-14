# Credits and provenance

## Original project

Lunar Navigator — Team An0r4k, NASA Space Apps 2026, Lunar Landing Site Navigator challenge. Original code is Apache-2.0. This license does not relicense third-party libraries, data, branding or imagery.

## Open-source software actually used

- [React](https://github.com/facebook/react): application components and state, MIT.
- [Three.js](https://github.com/mrdoob/three.js): WebGL scene and OrbitControls, MIT.
- [Vite](https://github.com/vitejs/vite) and its React plugin: development and production build, MIT.
- [SpiceyPy](https://github.com/AndrewAnnex/SpiceyPy): Python interface to NAIF CSPICE, MIT; CSPICE retains NAIF terms.
- [NumPy](https://github.com/numpy/numpy): scientific array calculations, BSD-3-Clause.
- [tifffile](https://github.com/cgohlke/tifffile): reading published terrain rasters, BSD-3-Clause.
- [PyShp](https://github.com/GeospatialPython/pyshp): used once to inspect PGDA RoI shapefiles; not a runtime dependency, MIT.
- [Python](https://github.com/python/cpython): scientific runtime, PSF License.
- [Fontsource](https://github.com/fontsource/fontsource): self-hosted Overpass and Fira Code packages; font software uses SIL Open Font License 1.1. [Overpass](https://github.com/RedHatOfficial/Overpass), [Fira Code](https://github.com/tonsky/FiraCode).
- [Wrangler / Cloudflare workers-sdk](https://github.com/cloudflare/workers-sdk): publishing the static Pages artifact, Apache-2.0/MIT per package notice.
- [Lighthouse](https://github.com/GoogleChrome/lighthouse): production auditing, Apache-2.0.

Installed JavaScript package versions, transitive dependencies, upstream repositories and preserved license texts: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), generated from package metadata. The site presents this inventory at **Credits**. Python dependencies and versions are recorded in [scientific/requirements.txt](scientific/requirements.txt) and scientific documentation; bundled NAIF code and kernel notices retain original terms.

Repository URLs are normalized to clickable HTTPS links. The `@paulirish/trace_engine` build-tool dependency links its upstream Chrome DevTools repository, with the packaging distinction recorded in credits.json. The `http-link-header` tool dependency's current official source is Codeberg, not GitHub; the actual upstream URL is preserved rather than inventing a GitHub repository.

## NASA and partner data / resources

- NASA JPL Solar System Dynamics, [Horizons](https://ssd.jpl.nasa.gov/horizons/): independent sampled reference queries; see scientific validation and cached provenance.
- NASA JPL [NAIF SPICE](https://naif.jpl.nasa.gov/naif/): ephemerides, orientations, time conversions; kernel versions and hashes in public/data/manifest.json.
- NASA LRO / LOLA, PDS Geosciences and NASA Goddard PGDA: elevation products and published study regions, used for terrain horizons. [PGDA 78](https://pgda.gsfc.nasa.gov/products/78), [PGDA 69](https://pgda.gsfc.nasa.gov/products/69). Cite Barker et al. (2021) and Mazarico et al. as recorded in the dataset and scientific README.
- Moon appearance: **NASA’s Scientific Visualization Studio**, [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), Ernie Wright (STC), Noah Petro (NASA/GSFC), LROC instrument team/Arizona State University. File lroc_color_2k.jpg, downloaded 2026-11-14. This aesthetic texture is not the numerical terrain model.
- Earth appearance: **NASA’s Goddard Space Flight Center**, Blue Marble data courtesy of Reto Stockli (NASA/GSFC), [Blue Marble Next Generation](https://svs.gsfc.nasa.gov/12564/). Original March 2004 monthly composite, world.topo.2004-03.png, downloaded 2026-11-14. Historical appearance, not 2027 weather or cloud cover. Earth rotation is the low-precision IAU_EARTH model for visualization only.
- [LROC QuickMap](https://quickmap.lroc.im-ldi.com/) and [NASA Moon Trek](https://trek.nasa.gov/moon/): exploration references in the official challenge resources, not copied application code or runtime dependencies.
- [Canadian Space Agency Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/): educational context, not a numerical source.

## Prior projects studied, not reused

Additional source inspection on 2026-11-14 (ideas only; no competitor code or assets incorporated):
- [Spacebee / Moonquakes](https://github.com/spacebee-technologies/Moonquakes-SpaceApps2023), revision `83ae92660862e10dc6c3820d16eaffae0990e6d5`: offline catalogue-to-JSON pipeline and guided access to scientific data.
- [42 Quake Heroes interface](https://github.com/gabrielchayb/42-quake-heroes), revision `b4c3ba7198a586789a47e3fac34d5479370d0cf0`: guided presentation separated from the scientific model.
- Connected Earth Museum: inspected the 2024-window revision `e2fc8e0b509e64d68ffc364c2b42d606d88a139f` separately from its 2025 rewrite. The exact judged revision is not established. Camera stops informed the idea of a short, navigable review.
- PureFlow 2025, revision `df234861e4710bf463595396f4c85b8b58574a89`: immediate quantified consequences informed our constraint feedback and downloadable comparison record.

We studied 24 previous global winners (repositories where observed, otherwise official pages, live demos or news). Licences differ: several competition-window commits had no root licence, one (Storm Prophet) was MIT. We learned presentation and architecture principles and implemented our own code; no competitor code or assets are included. This is inspiration, not a dependency, and does not establish the judges' reasons for an award. Every source and repository is linked in [docs/WINNER-LESSONS.md](docs/WINNER-LESSONS.md).

Research considered prior winners and related tools. No competitor code was copied into this implementation. If any future reuse occurs, record the exact repository, revision, files and license here before publication. Inspiration is distinct from a dependency or validated scientific reference.

- [Connected Earth Museum](https://github.com/connected-earth/connected-earth-museum): studied as an example of guided scientific exploration; no code/assets reused.
- [PureFlow 2025](https://github.com/larasdiniz/PureFlow-2025): studied as an example of making a mission choice and seeing consequences; no code/assets reused.
- [42 Quake Heroes scientific notebook](https://github.com/gabrielchayb/42-model-source-notebook): studied for inspectable methods and the importance of defining a metric; not part of our calculation.
- [CLPS Lunar Mission Browser](https://github.com/EmanuelAbasto/CLPS-Lunar-Mission-Browser), [LuminaLuna](https://github.com/Planet-Coders/lunar-landing-site-navigator) and [Lunar Horizon](https://github.com/localizedprojects/CLPS-MOON-BROWSER): related-tool descriptions studied during research; no application code imported, their performance claims not independently reproduced.

## V2 visual assets and conversion tools

- NASA SVS [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/): LROC 2025 albedo, converted from the 16-bit 4k TIFF to sRGB JPEG; LOLA `ldem_4` global elevation in metres. Credit: NASA's Scientific Visualization Studio and the LRO LROC/LOLA teams. Physical vertical scale is 1.0. Isotropic polar filtering and uniform physical-baseline normals avoid equirectangular polar sampling artifacts. Global relief is explanatory, distinct from the numerical horizon products.
- PGDA 5 m terrain, with PDS 80 m fallback: four 20 km windows averaged to 40 m for oblique visual geometry. Exact spherical positions preserve curvature. The numerical visibility metrics continue to use the independently generated horizon profiles.
- [NASA Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/): NASA/Goddard Space Flight Center Scientific Visualization Studio; Gaia DR2: ESA/Gaia/DPAC. EXR converted from linear values to sRGB JPEG. Catalogue positions retained; brightness and colour are illustrative.
- Blue Marble March 2004: the credited original above was converted to 4k desktop and 1k mobile JPEGs with Lanczos resampling. Historical appearance, not live weather.
- [Pillow](https://github.com/python-pillow/Pillow), HPND; [OpenEXR](https://github.com/AcademySoftwareFoundation/openexr), BSD-3-Clause; [imagecodecs](https://github.com/cgohlke/imagecodecs), BSD-3-Clause: optional local conversion tools, not browser dependencies. Versions and roles are recorded in `scientific/requirements.txt`.

Exact source URLs, transformations, checksums and limitations accompany the assets in `public/data/globe/visual-assets.json`, `moon-elevation.json`, `terrain/terrain.json` and `starmap/starmap.json`. The old `lroc_color_2k.jpg` texture is retained as a historical fallback asset; the V2 renderer uses the credited 4k desktop / 1k mobile conversion.

## AI assistance and review

Continuous verification uses MIT-licensed [actions/checkout](https://github.com/actions/checkout) at `d23441a48e516b6c34aea4fa41551a30e30af803` and [actions/setup-node](https://github.com/actions/setup-node) at `249970729cb0ef3589644e2896645e5dc5ba9c38`. They run only in GitHub Actions, with read-only repository permissions. Their source is referenced, not bundled in the browser.

### True-scale simulator revision

Every 3D solid body now uses its documented physical radius and apparent ephemeris position in the same unit system; earlier compressed distances and enlarged planetary meshes were removed. Camera inspection changes viewpoint only. Floating rendering origin avoids loss of precision far from the Moon. Surface normals, optical exposure, atmosphere and glare are rendering approximations, not validated photometry or a weather forecast.

Earth ground: NASA Blue Marble, 4096×2048 desktop / 1024×512 mobile conversions, unchanged source colours. Additional cloud alpha and ocean-specular layers: **Solar System Scope**, [source textures](https://extension.solarsystemscope.com/textures/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), based on NASA imagery; converted to greyscale JPEG for this project. The fixed cloud pattern is illustrative and does not represent weather at the simulated time. Source URLs, input/output hashes, changes and limitations are preserved in `public/data/globe/earth-layers.json`. These attributed assets retain CC BY 4.0 and are not relicensed as Apache-2.0.

Claude and Codex assisted research, implementation, explanation, testing and documentation. See [public/ai-use.json](public/ai-use.json). Scientific numbers come from deterministic code processing the cited resources; no ephemeris/terrain values are invented by an LLM. A generated UI design reference was used privately, with visible labeling; it is not shipped as scientific imagery. The real-time scene is a code rendering of cited data, not a generated photograph.

## Brand and rights

No NASA approval, certification or endorsement is claimed. NASA protected identifiers are not the team identity. Any official Space Apps asset must be used unchanged and under its brand rules, separate from generated content. No personal portraits or voices are included in this application.

Official Space Apps logo: original **Logo Geral - Branco.png**, supplied in the [Campinas organizer folder](https://drive.google.com/drive/folders/1oEYEEhBYOhOAP3cxB3eObGyAclqgAGnO), file ID 1UP7H6w3Te5Ja4n0vscKjWot2buCc-FqT, downloaded 2026-11-14 without alteration. Used only to identify participation, with clear space; not the app identity and not an endorsement. Brand rights remain with their owner, outside the Apache-2.0 code license.

Mobile texture derivatives (Moon, Earth, clouds, ocean mask and stars): Lanczos 1024 x 512 conversions of the credited parent assets. Parent/output hashes and inherited licences are in public/data/globe/mobile-textures.json. No source elevations or numerical visibility products were changed.
