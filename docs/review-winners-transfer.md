# Lessons from past global winners

**Study date:** 2026-11-14.

We read the public repositories of four NASA Space Apps **Global Winners** to see what we could learn. We did not run, install or build their code, and we copied no code from them. The repositories were treated as data, not instructions.

This page records patterns we observed in the files we read. Judges' scores are not public, so nothing here explains why a project won.

| Project | Year and award | Repository | What we read (commit) |
| --- | --- | --- | --- |
| Spacebee (Aónikenk) | 2023, Best Use of Technology | [spacebee-technologies/Moonquakes-SpaceApps2023](https://github.com/spacebee-technologies/Moonquakes-SpaceApps2023) | `83ae926` (latest commit; all 74 commits fall on 7–8 Oct 2023) |
| 42 QuakeHeroes | 2024, Best Use of Technology | [gabrielchayb/42-quake-heroes](https://github.com/gabrielchayb/42-quake-heroes) (interface) | `b4c3ba7` |
| Connected Earth Museum | 2024, Art & Technology | [connected-earth/connected-earth-museum](https://github.com/connected-earth/connected-earth-museum) | `e2fc8e0` (last commit inside the event window) and `b86c480` (2025 rewrite) |
| PureFlow | 2025, Best Mission Concept | [larasdiniz/PureFlow-2025](https://github.com/larasdiniz/PureFlow-2025) | `df23486` |

Award status was taken from the official global-winner pages for [2023](https://www.spaceappschallenge.org/2023/awards/global-winners/), [2024](https://www.spaceappschallenge.org/nasa-space-apps-2024/awards/global-winners/) and [2025](https://www.spaceappschallenge.org/2025/awards/global-winners/).

## Patterns in the files we read

- **Data prepared before the app runs.** A data processor turns published moonquake catalogues into JSON (Spacebee). Monthly climate textures are prepared ahead of time (Connected Earth). Model results are presented as recorded videos, with the method in a separate notebook repository (QuakeHeroes).
- **A guided path before free exploration.** Connected Earth stores camera stops as data in `museum_map.js`. QuakeHeroes moves through a linear sequence of pages. PureFlow goes home → briefing → designer.
- **Immediate, quantified feedback.** PureFlow recomputes its checks after every edit, highlights the failing module in the 3D scene, and states the required and current values.
- **Illustrative physics alongside real data.** In the code we read, Spacebee's day–night light is driven by a slider, not an ephemeris.
- **The evaluated version can be unclear.** Connected Earth was largely rewritten in 2025. Files in its current version are not present in its last commit from the event weekend.

These are observations from a small sample. They are not rules for winning.

## What we changed or are changing in Lunar Navigator

1. **Reproducible record.** You can download each comparison as JSON, with settings, coverage, validation status, input-data hashes and limitations.
2. **Feedback where the decision is made.** The darkness constraint shows the observed value against the user's example limit, with a bar and the margin. Lower bounds are labelled "at least".
3. **Visible evidence.** The three-minute review page shows validation results from `data/validation.json` and their stated limits. These are comparison with JPL Horizons at sampled instants, datum and convergence checks, and reproduction of a published illumination class.
4. **A frozen release candidate.** The commit and deployment proposed for evaluation will be tagged, so later changes cannot be confused with it.

We deliberately did **not** add a chatbot, AR, a game engine or claims we cannot support with code and data.
