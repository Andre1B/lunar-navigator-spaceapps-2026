# Lunar Navigator

**If a lunar landing is delayed, does the original location still offer useful sunlight and direct Earth visibility?**

Team An0r4k’s NASA Space Apps 2026 educational prototype for [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/). A guided investigation and an unrestricted workspace connect a clear decision to the source data and its limitations.

## Use the project

- Guided analysis: approximately ten minutes, with freely accessible chapters.
- Open Workspace: Home, Simulator, Compare, Evidence and Credits are separate screens, never locked behind mission progress.
- Faithful Mode: shared astronomical time.
- Free Mode: independently freeze selected body positions/orientations; experimental configurations never supply mission recommendations.
- Explore space: hide the surrounding interface; return with the visible control or Escape.
- [Three-minute review](https://lunar-navigator-2026.pages.dev/#/review): question, current scenario results and executed evidence, with direct navigation to every tool.
- Compare: editable example darkness limit, lower-bound-aware feedback and a downloadable JSON recording the same results, provenance, derived-data hashes and build identity.

Data covers six points on published polar terrain (two published region centroids and four points selected by us, including two nearby fixed-offset neighbors), 2027-03-01 through 2027-04-28, observer heights 1/5 m. Locations are **not selected/certified landing sites**. Window comparisons use visible solar fractions, darkness intervals and direct Earth visibility. Out-of-coverage windows are not calculated.

## Run locally

Node.js 22 or newer and npm:

```sh
npm ci
npm run dev
```

```sh
npm test
npm run credits
npm run build
npm run preview
```

The public site needs no login, server-side account, API key or installation. Its documented data is generated offline and served statically. The WebGL renderer is loaded only on the simulator route; data and comparisons remain available without WebGL.

Mobile visual textures are 1024 x 512 derivatives of the credited parent images; desktop retains 4k ground imagery. GPU preparation is split into texture uploads and asynchronous shader compilation. Globe geometry is computed in a worker. Numerical data and terrain visibility are unchanged by the visual quality tier.

## Science and verification

[scientific/README.md](scientific/README.md) documents the source products, model, conventions and reproducible generator. [public/data/manifest.json](public/data/manifest.json) records versions, checksums and coverage. [public/data/validation.json](public/data/validation.json) contains executed checks and evidence, including caveats about exploratory target selection and limited sampled agreement. Independent tests are in tests/.

Mean solar-disc fraction is an hourly approximation. Duration events use a five-minute search and refined boundaries of at most one minute; shorter events may be missed. The comparison does not mix those duration estimates with the generator's whole-period metrics. Boundary-touching intervals are lower bounds.

All solid 3D bodies share the same **physical scale for radii and distances**. Named camera views change viewpoint and zoom, never body size. Labels and the optical solar glare are illustrative overlays. The surface sky uses true angular sizes and a local terrain-horizon silhouette. The globe's appearance is separate from the elevation model used for visibility calculations. Earth appearance is a historical Blue Marble composite with fixed illustrative clouds; orientation is the visual-only IAU_EARTH model.

## Rights and acknowledgments

Original code: [Apache-2.0](LICENSE). Third-party software, data and images retain their own rights and terms. See [CREDITS.md](CREDITS.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the public Credits screen. No competitor application code is reused. All future reuse must preserve the original notices and identify the exact source.

AI-assisted research, code, explanatory text, documentation and verification are disclosed in [public/ai-use.json](public/ai-use.json), including the unresolved official interpretation of earlier assisted ideation. Numerical samples are computed from the cited data, not invented by language models. NASA does not author, endorse or certify this prototype. No claim of submission eligibility is made.

## Summaries and project records

- [HTML summary](public/summary.html)
- [Plain-text summary](public/summary.txt)
- [Six-slide public demo](https://lunar-navigator-2026.pages.dev/demo/)
- [Executed release verification](docs/VERIFICATION.md)
- [Machine-readable release evidence](docs/release-evidence.json)
- [Production checkpoint / ownership](docs/PROGRESS.md)
- [Scientific checkpoint](scientific/PROGRESS.md)
- [Test checkpoint](tests/PROGRESS.md)
- [Design rationale](docs/DESIGN.md)
- [Lessons from 24 previous global winners and what we applied](docs/WINNER-LESSONS.md)

## Limits

Sunlight does not establish electrical generation or battery survival. Direct Earth visibility does not establish antenna pointing, link budget, DSN access or relay coverage. No landing-safety certification, orbital mission design or current-weather service is provided.

## First interaction
The opening ends on Home, with the question and ready-to-use comparison. Normal-motion entries play automatically; reduced-motion, tours and exact comparison inspections start paused. On Home, try +3/+7/+14 days to see a real two-arrival comparison immediately, then open those same settings in Compare. A nearby-point shortcut changes only the alternative location. Sun/Earth aiming follows the current direction continuously; manual dragging releases following.
