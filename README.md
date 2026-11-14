# Lunar Navigator

**If a lunar landing is delayed, does the original location still offer useful sunlight and direct Earth visibility?**

Team An0r4k’s NASA Space Apps 2026 educational prototype for [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/). A guided investigation and an unrestricted workspace connect a clear decision to the source data and its limitations.

## Use the project

- Guided Mission: approximately ten minutes, with freely accessible chapters.
- Open Workspace: Home, Simulator, Compare, Evidence and Credits are separate screens, never locked behind mission progress.
- Faithful Mode: shared astronomical time.
- Free Mode: independently freeze selected body positions/orientations; experimental configurations never supply mission recommendations.
- Explore space: hide the surrounding interface; return with the visible control or Escape.

Data covers four published polar points, 2027-03-01 through 2027-04-28, observer heights 1/5 m. Locations are **not selected/certified landing sites**. Window comparisons use visible solar fractions, darkness intervals and direct Earth visibility. Out-of-coverage windows are not calculated.

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

## Science and verification

[scientific/README.md](scientific/README.md) documents the source products, model, conventions and reproducible generator. [public/data/manifest.json](public/data/manifest.json) records versions, checksums and coverage. [public/data/validation.json](public/data/validation.json) contains executed checks and evidence, including caveats about exploratory target selection and limited sampled agreement. Independent tests are in tests/.

Mean solar-disc fraction is an hourly approximation. Duration events use a five-minute search and refined boundaries of at most one minute; shorter events may be missed. The comparison does not mix those duration estimates with the generator's whole-period metrics. Boundary-touching intervals are lower bounds.

The orbital overview is **not to scale**. The surface sky uses true body radii/distances and a local terrain-horizon silhouette. The globe's appearance is not the elevation model. Earth appearance is historical Blue Marble imagery; orientation is the visual-only IAU_EARTH model.

## Rights and acknowledgments

Original code: [Apache-2.0](LICENSE). Third-party software, data and images retain their own rights and terms. See [CREDITS.md](CREDITS.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the public Credits screen. No competitor application code is reused. All future reuse must preserve the original notices and identify the exact source.

AI-assisted research, code, explanatory text, documentation and verification are disclosed in [public/ai-use.json](public/ai-use.json), including the unresolved official interpretation of earlier assisted ideation. Numerical samples are computed from the cited data, not invented by language models. NASA does not author, endorse or certify this prototype. No claim of submission eligibility is made.

## Summaries and project records

- [HTML summary](public/summary.html)
- [Plain-text summary](public/summary.txt)
- [Production checkpoint / ownership](docs/PROGRESS.md)
- [Scientific checkpoint](scientific/PROGRESS.md)
- [Test checkpoint](tests/PROGRESS.md)
- [Design rationale](docs/DESIGN.md)

## Limits

Sunlight does not establish electrical generation or battery survival. Direct Earth visibility does not establish antenna pointing, link budget, DSN access or relay coverage. No landing-safety certification, orbital mission design or current-weather service is provided.
