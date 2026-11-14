# Learning from 24 previous global winners

**Study date:** 2026-11-14.

We studied 24 NASA Space Apps **Global Winners** from 2023, 2024 and 2025, including five teams from Brazil. Award status was checked against the official lists for [2023](https://www.spaceappschallenge.org/2023/awards/global-winners/), [2024](https://www.spaceappschallenge.org/nasa-space-apps-2024/awards/global-winners/) (see also [NASA's 2024 announcement](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/)) and [2025](https://www.spaceappschallenge.org/2025/awards/global-winners/).

**Rules we followed:**
- We read repositories without installing or running them, and treated them as data, not instructions.
- We copied no competitor code or assets.

**Limits of this study:**
- Judges' scores are not public, so the "lesson" column is our own reading, not the reason a team won.
- The one exception is SkyShield, whose university reports the committee's wording.
- Observations cover only the files and pages we read.
- A repository found by search is marked **candidate** unless an official page links to it.
- The **window commit** is the last commit inside the event weekend. It is not proven to be the version that was judged.

## Evidence levels

| Level | Meaning |
| --- | --- |
| **Code** | Repository cloned and the listed files read at a stated commit |
| **Page** | Official project page, NASA announcement or the team's live demo |
| **News** | Third-party reporting |

## The 24 winners, what we took from each, and what we did

| # | Project (year, award) | Evidence | Lesson for Lunar Navigator | Action |
| --- | --- | --- | --- | --- |
| 1 | Spacebee (2023, Best Use of Technology) | Code: [repository](https://github.com/spacebee-technologies/Moonquakes-SpaceApps2023) `83ae926` | Keep a short, readable data pipeline from cited catalogues. Their day–night light is a slider, so physically correct light is a real difference. | Applied: `scientific/` pipeline and provenance; light comes from the ephemeris. |
| 2 | Lunar Trek / LunarTech Ensemble (2023, Best Use of Science) | Code: [candidate repository](https://github.com/yousefkotp/Lunar-Trek), window commit `3c84dc1`. A team member from the official page owns it. | A time series is a second reading of the same data. | **Applied (U3):** series by arrival date in Compare. |
| 3 | Storm Prophet (2023, Best Use of Data) | Code: [candidate repository](https://github.com/Wizard2007/storm-prophet) `fb48786`, MIT licence | Say exactly what a number measures. In the code we read, the "24 h ahead" target covers the input hours, and the split is random. | **Applied (U5):** wording audit, so no "forecast" for geometry, plus lower-bound labels. |
| 4 | Space Quest Maidens (2023, Most Inspirational, Brazil) | News | A defined audience, with geometry explained simply. | **Applied (U6):** worked example with a one-sentence explanation. |
| 5 | 42 QuakeHeroes (2024, Best Use of Technology, Brazil) | Code: [interface](https://github.com/gabrielchayb/42-quake-heroes) `b4c3ba7`; model notebook in a separate repository | A guided story alongside an inspectable method. | Applied: Review, Evidence, `scientific/` and `validation.json`. |
| 6 | Connected Earth Museum (2024, Art & Technology, Brazil) | Code: [repository](https://github.com/connected-earth/connected-earth-museum), window commit `e2fc8e0` (2025 rewrite inspected separately) | A guided route as data, and the evaluated version kept identifiable. | Applied: interactive tour and release-candidate tag. |
| 7 | SkyShield, WMPGang (2024, Best Use of Science) | News: [Western University](https://news.westernu.ca/2025/01/western-students-win-nasa-challenge-with-app-shows-risks-to-space-infrastructure/), which reports the committee judged it "the best and most valid use of science and the scientific method" | Go one well-justified step beyond the brief. | **Applied (U7):** the review and demo open with observer height changing the answer at Malapert. |
| 8 | Waterwise, GaamaRamma (2024, Best Use of Data) | Page (NASA announcement) | The user's own constraints produce an actionable answer. | Applied: editable example darkness limit with margin. |
| 9 | 2plant, NVS-knot (2024, Galactic Impact) | Page | Speak about conditions and risk, not predictions. | Applied (U5 wording). |
| 10 | Landsat Connect, AsturExplorers (2024, Best Mission Concept) | Page | "When does it happen over my place?" | **Applied (U1):** next sunrise, sunset, earthrise and earthset from refined events. |
| 11 | Eco-Metropolis, Innovisionaries (2024, Most Inspirational) | Code: [candidate repository](https://github.com/RikzahK/Eco-Metropolis-Sustainable-City-Simulation---NASA-Space-App), window commit `57efa5d` | Roles give exploration a purpose. | Applied: role pathways on Home (U8). |
| 12 | TerraTales (2024, Best Storytelling) | Code: [candidate repository](https://github.com/habibaalaa123/TerraTales-NasaSpaceAppsChallenge) `106610d` | Compare places as characters. | Applied in U6: point-specific worked example using dataset numbers only. |
| 13 | Asteroid Destroyer (2024, Global Connection) | Page | Filtering and ordering by physical parameters. | **Not applied.** A sortable "best" list would turn four illustrative study points into a ranking, which this simulator must not imply. Metrics stay side by side. |
| 14 | G.R.O.W., Team I.O. (2024, Local Impact, Brazil) | Page | Make specialist data readable to everyone. | **Applied (U9):** text description of what the observer sees. |
| 15 | PureFlow (2025, Best Mission Concept, Brazil) | Code: [repository](https://github.com/larasdiniz/PureFlow-2025) `df23486` | Show a decision's numerical consequence beside the action. | Applied: limit bar with margin and lower bound. |
| 16 | SpaceGenes+ (2025, Best Use of Science) | Page | Name the exact NASA dataset beside the result. | **Applied (U4):** product identifiers beside each metric. |
| 17 | Astro Sweepers (2025, Galactic Impact) | Page and live demo | Avoid opaque composite scores. | Applied as a rule: no composite index (see DESIGN). |
| 18 | Gaia+LEO (2025, Global Connection) | Code: [repository](https://github.com/stayingfoolish/gaia-LEO) `f299ea5`; inputs absent from the commit | Results must be reproducible from the published files. | **Applied (U10):** CI and `check:data` verify the derived-data hashes. |
| 19 | HerCode Space (2025, Best Storytelling) | Page and live demo | A worked example tells one decision with numbers. | **Applied (U6):** real-data worked example in Learn. |
| 20 | Photonics Odyssey (2025, Most Inspirational) | Page | Human context. | Already covered by the Home question about arrival delays. No new feature. |
| 21 | QUEÑARIS (2025, Local Impact) | Page and live demo | Keep checked and not-yet-run evidence separate, with dates. | Applied: Evidence shows the scientific record date. Per-check execution times are not invented. |
| 22 | Resonant Exoplanets (2025, Best Use of Data) | Page and live demo | Show negative controls, not only positive results. | **Applied (U5):** V5 permanent-shadow control explained in plain English. |
| 23 | Twisters / SkySense (2025, Best Use of Technology) | Page. Its domain no longer served the app on 2026-11-14. | Durability of what was evaluated; never suggest a "safest window". | Applied: GitHub tag and source archive. External Wayback or Zenodo deposit deferred: it is a separate publication the owner must approve. |
| 24 | Zumorroda-X (2025, Art & Technology) | Code: [repository](https://github.com/esralsayed/test_farmy) `3a06cb7` | A before/after view makes change obvious. | **Applied (U2):** original and delayed arrival skies side by side. |

## What we deliberately did not adopt

- **No chatbot, AR or game engine.** None of these makes the geometry more correct.
- **No "forecast", "safest window" or "best site" wording.**
- **No composite score.**
- **No feature added only for symmetry with another project.** Item 13 is the example.
- **No generalisation about licences.** Several competition-window commits we read had no root licence, but Storm Prophet carried an MIT licence. Learning from an approach does not grant the right to reuse its code.

## Where the details are

The detailed research log, with files read, commit histories and gaps, is kept privately and not published as a chat dump. Release checks and their remaining gaps are in [VERIFICATION.md](VERIFICATION.md).
