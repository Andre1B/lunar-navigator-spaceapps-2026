# Winner deep audits: what the live demos actually do

Started 2026-11-15 by Sonnet agent 464900fb. These are **runtime audits of official 2025 Global Winners** whose team pages link a live demo. Status comes from the official [2025 Global Winners page](https://www.spaceappschallenge.org/2025/awards/global-winners/); that page says winners "were chosen by Executive Judges from the Global Finalists". No judge statement about any project is public, so every "why it may have won" line is an **inference**, not a reason given by judges. The 110 indexed records are *not* 110 deep studies; each audit below records its `depth`.

## Depth scale

| depth | Meaning |
| --- | --- |
| `runtime-deep` | Every main route opened, controls clicked, results observed, screenshots taken |
| `runtime-partial` | Some routes or states observed; gaps listed |
| `static` | Page text, files or HTTP only |
| `blocked` | The demo could not be opened; no runtime claim made |

## Method and limits

- One browser tab of my own, closed by its tab id. Viewport 1408×792. GPU-heavy canvases are deferred while the simulator is being profiled.
- **Not tested** in any audit unless stated: keyboard-only use, mobile layout, reduced motion, screen reader, audio. The demos were not stress-tested.
- Screenshots were taken at reduced JPEG quality and are slightly soft. They are private evidence in `tmp/winner-deep-audits/`.
- No code or assets copied. Repositories are cited only when the team page links them.

## How to read these audits

Everything below describes the **public version observed on 2026-11-15**, not the version that was judged and not the reason for any award. Each audit lists the strongest idea and what helps a newcomer first, then the observed behaviour, then problems. Problems are findings about today's deployment (links, servers and configuration change after a hackathon).

## Status of the audits

| Project | Official status | Demo | Depth | Result |
| --- | --- | --- | --- | --- |
| Resonant Exoplanets | 2025 Global Winner, Best Use of Data | https://resonant-planet.vercel.app/ | `runtime-deep` (3D tab only glanced at) | Done |
| QUEÑARIS | 2025 Global Winner, Local Impact | https://quenaris.vercel.app/ | `runtime-deep` | Done |
| Astro Sweepers | 2025 Global Winner, Galactic Impact | https://astro-sweepers.vercel.app/ | `runtime-partial` | Done (replaces Photonics as the live-site audit) |
| Photonics Odyssey | 2025 Global Winner, Most Inspirational | Canva deck and Drive folder only; no interactive demo | `blocked` for any prototype; deck thumbnails only | Section 4 |
| Zumorroda-X | 2025 Global Winner, Art & Technology | https://henrysfarmadventures.vercel.app/ | `runtime-partial` | Section 5: intro scene only; later scenes not reached |

---

## 1. Resonant Exoplanets (2025, Best Use of Data)

- **Sources observed:** team page `?tab=project`; demo https://resonant-planet.vercel.app/ ; the video and the "Research Paper" and "Presentation" buttons were **not** opened. No team repository is linked.
- **Version/date:** live 2026-11-15. Page title "Exoplanet AI - Hunting for New Worlds".

### Strongest idea and what helps a newcomer

- **Strongest move:** one landing page that tells the whole story in order (promise, features, method in two plain lists, one worked example) and a single obvious "Launch Explorer" button into a real tool shell. The method lists (detection pipeline, four validation tests) are short and readable.
- **Helps a layperson:** a class-balance bar (48% false positive, 24% candidate, 28% confirmed) explains the problem before any model exists; the Dataset tab lets anyone browse real rows; the 3D tab lists 19 named K2 planets with radius and year and the hint "Drag to rotate • Scroll to zoom • Click planet to select".
- **Observed motion:** a star field behind the app, gradient text, and an animated tab highlight; no timing measured.

### Flow (start → core → result)

1. Landing: hero "Discover exoplanets and biosignatures with exact computation", four buttons (Launch Explorer, View Presentation, Read Research Paper, Learn the Method), feature cards, a "Validated Discovery" block for K2-18b.
2. **Launch Explorer** opens an app shell with six tabs: Dashboard, Train Model, Predict, Upload Data, Explore, Dataset, and a footer showing "Backend Online".
3. Core action: **Train Model** (Kepler or TESS, test split 10–40%, balancing mode, Start Training).
4. Result: see ledger. The core action fails.

### Visual (observed)

- Typeface: **Space Grotesk** for headings and body.
- Landing: near-black field with a faint warm planet arc, a violet-to-cyan gradient on key words ("biosignatures", "exact computation"), pill badges, a purple primary button and outlined secondary buttons.
- App shell: deep navy with a star field, glass-style cards with violet borders, a violet gradient primary button, a pink gradient page title.
- Hierarchy: one large title per screen, small grey helper text, then cards. Tabs are a top bar with an active-pill highlight.

### Ledger (screen → action → effect → source → limit)

| Screen | Action | Observed effect | Evidence | Limit |
| --- | --- | --- | --- | --- |
| Landing | Read | Claims: "Zero rounding errors", "5,500+ confirmed exoplanets", "K2-18b validated", "Expert-matching results"; shows a table of O₂, CH₄, PH₃, DMS "ppm" values and "Biosignature Score: 0.45 / 1.00" | page text | Static marketing text; no calculation was visible or runnable |
| Landing | Launch Explorer | Opens the app shell | click | none |
| Dashboard | Read | "Model Status: Not Trained", Accuracy and ROC AUC "N/A", class distribution FALSE POSITIVE 48% / CANDIDATE 24% / CONFIRMED 28%, 9,564 records | page text | Metrics are empty until a model is trained |
| Train Model | Start Training (Kepler, 20% split, SMOTE) | "Training Failed — Request failed with status code 405", a Retry button. Reproduced twice | click, screenshot 3 | HTTP 405 comes from `POST /api/model/train` on the demo's own host; the "Backend Online" badge stayed green |
| Predict | Open | "Model Not Trained. Please train the model first" with a "Go to Training" link | click | The prediction path is unreachable because training fails |
| Upload Data | Open, click Analyze Data | Analyze Data stays disabled until a file is chosen; shows required columns (koi_period, koi_depth, …) and a sample-CSV button | click | I did not upload a file |
| Explore | Open | A 3D scene (canvas) and a list of 19 K2 planets with radius and year; "Drag to rotate • Scroll to zoom • Click planet to select" | click, text | Seen for under a minute (GPU reserved); no planet was selected, so no detail panel observed |
| Dataset | Open | Counts: Kepler 9,564, K2 525, TESS 7,842 (17,931); bars for disposition; period-vs-radius scatter; first 20 rows | click, text | Data described as "local CSV files"; not independently checked |

### What is real and what is only claimed

- **Real (observed):** a working multi-tab web app, dataset counts and tables, a 3D K2 list, input validation (disabled button), and honest "Not Trained" states.
- **Claimed but not observed working:** training an ensemble (XGBoost, LightGBM, CatBoost, forests, neural net), prediction, upload analysis, the "Modulus" exact-arithmetic solver, "zero rounding errors", "expert-matching" K2-18b detection. The landing's biosignature numbers are static text.
- **Internal contradiction:** the landing says it identifies molecules at "19,145 ppm" and "79,106 ppm" for K2-18b with a score of 0.45, while the app reports no trained model and the training endpoint returns 405. The page cites a published result (Madhusudhan et al. 2023) as the match; I did not check that claim.

### Animation, feedback, errors

- Observed: a star-field background, gradient text, hover/active tab states, an error state with an icon and a Retry button. Triggers were not timed and reduced-motion was not tested.
- Errors are shown in plain language but give no cause; the green "Backend Online" badge is misleading while a core endpoint fails.

### Screenshots

`resonant-1-landing.jpg` (first), `resonant-2-train-config.jpg` (middle), `resonant-3-train-failed-405.jpg` (end).

### Transfers to Lunar Navigator (by criterion; no judge scores)

| Criterion | Observation | Transfer |
| --- | --- | --- |
| Presentation | The class-balance bar explains the problem before any model runs; empty tabs say what to do next ("Go to Training") | Lunar can open Compare with one plain sentence on what the three scenarios will show before the user changes anything, and give any screen that waits for a choice a one-line next step. |
| Relevance | The Dataset tab shows real counts and the first rows | A small "data used" table (source, sample count, period) beside Compare results, built from `manifest.json`. |
| Impact | "Zero rounding errors" and "expert-matching" sit next to no visible check | Already how Lunar works (claims sit beside tests and dates in Evidence). Nothing to add. |
| Validity | The status badge was green while the core action failed | Not applicable: Lunar is static and has no backend status. Noted only as a finding about this deployment. |
| Creativity | Gradient-on-keywords hero is distinctive but common | Do not copy. Lunar's own signature is the real 360° horizon. |

### Limits of this audit

3D scene not interacted with; no file uploaded; video, paper and presentation links not opened; keyboard, mobile and reduced motion not tested.

---

## 2. QUEÑARIS (2025, Local Impact)

- **Sources observed:** team page; demo https://quenaris.vercel.app/ (routes `/`, `/ndvi-map`, `/historical-ndvi`, `/zone-analysis`). The YouTube video was not opened. No repository is linked.
- **Version/date:** live 2026-11-15. Title "Queñaris - Intelligent Reforestation for Arequipa's Water Future".

### Strongest idea and what helps a newcomer

- **Strongest move:** the Zone Analysis screen. A real drone photograph fills the width, a faint 3×3 grid sits over it, and one click zooms to a green-framed zone with two clear buttons ("Analyze with AI", "Back to Full View"). The user touches the actual forest, not a chart.
- **Helps a layperson:** the landing explains the problem in three cards (undetected wildfires, water scarcity, degraded ecosystems) before any tool; the NDVI legend gives each value range a plain label ("Bare soil", "Moderate vegetation"); the title and green brand colour tie directly to the local tree.
- **Observed motion:** a glowing green primary button, a scroll-hint icon, a zone frame that appears on click, and a loading state before results. Timings not measured.

### Flow

Landing → NDVI Map → Historical Analysis → Zone Analysis (the core: pick a zone of a drone photo, ask for "AI analysis").

### Visual (observed)

- Typeface **Inter**. Background `rgb(9, 11, 17)` with a **neon green** brand colour for logo, nav, headline and buttons, and a dim blue Earth arc behind the hero.
- Hero: very large green "Queñaris" title, a grey subtitle, a glowing green primary button and an outlined secondary button; a scroll hint (mouse icon). Content sections are dark cards.
- Zone Analysis: a full-width **aerial drone photograph** of the forest as the main visual, with a thin 3×3 grid and a bright green frame on the selected zone.
- NDVI legend (observed): seven swatches, with **red for the densest vegetation (0.8–1.0) and orange for high vegetation**, green for moderate, dark red for bare soil.

### Ledger

| Screen | Action | Observed effect | Evidence | Limit |
| --- | --- | --- | --- | --- |
| Landing | Read | Header badge says "NASA SPACEUP CHALLENGE 2025"; counters show "0 ha", "0", "09 626 m³", "0 years" in the static read | text, screenshot 1 | Counters may animate on scroll; I did not scroll to trigger them. The challenge name differs from "NASA Space Apps" |
| Landing | Embedded video | "Loading video…", then a video file served from Cloudinary | resource list | Not played |
| NDVI Map | Open | A Leaflet basemap of Arequipa loads (21 tiles). The page also shows "Error loading map. Request was blocked by a browser extension… Allow requests to localhost". No NDVI overlay layer was found in the DOM | text, DOM count, screenshot 4 | The message blames extensions, but the page also requested a TIFF from a storage host; a missing overlay is not explained |
| Historical Analysis | Open (slider 2005–2025, default 2020) | "Could not load historical map" yet shows Average NDVI 0.550, Change from previous year "N/A", Data Coverage 1750 pixels | text | A request went to `…/undefined/ndvi-historical/`, i.e. an unset address; the figures appear without a map |
| Zone Analysis | Click Center | The photo zooms to that zone with a frame; buttons "Analyze with AI" and "Back to Full View" | click, screenshots 2 and 3 | Nine named zones (Northwest … South) plus Zoom Mode |
| Zone Analysis | Analyze with AI | The page calls `gemini-2.5-pro:generateContent` directly from the browser. Result header: **"Simulated AI Analysis • Gemini API Fallback"**, then cards: NDVI **0.04**, slope 3°, water 9 m, trees detected 21, text "NDVI: 0.29", "Plant 163 Queñua trees", "Maintain 76% forest density" | click, text, resource list | The card number (0.04) and the sentence (0.29) disagree; results are labelled simulated |

### What is real and what is only claimed

- **Real (observed):** a deployed multi-route site, a real basemap, a high-resolution aerial photo, an interactive 3×3 zone selector, a legend, and a call attempt to a large language model service.
- **Not observed working:** NDVI overlay, historical NDVI map, the 2005–2025 "time series" visual, fire detection, water-proximity zones.
- **Disclosed as simulated by the app itself:** the zone analysis results ("Simulated AI Analysis • Gemini API Fallback").
- **Claimed on the page, not demonstrated here:** "Real-time fire detection", "up-to-the-minute" Earth Engine feeds, "regulated water 09 626 m³" and other impact counters.

### Animation, feedback, errors

- Observed: a start-up glow on buttons, a scroll-hint icon, the zone frame appearing on click, and a loading state before results. Exact transitions were not timed.
- The NDVI error text offers a "Retry" button and a self-help list, yet the likely cause is the app's own configuration (an `undefined` address).

### Screenshots

`quenaris-1-landing.jpg`, `quenaris-2-zone-grid.jpg`, `quenaris-3-zone-zoom.jpg` (zone zoom with the Analyze button), `quenaris-4-ndvi-map-legend.jpg` (map and legend).

### Transfers to Lunar Navigator

| Criterion | Observation | Transfer |
| --- | --- | --- |
| Presentation | Click a region of a real image, see a frame, then ask: the place feels concrete | **Option to validate with the lead, not a requirement:** make the 360° horizon clickable by sector, opening the sentence `SkyDescription` already builds for that direction. Uses existing data only. |
| Relevance | A clear local problem ties the demo together | Keep Lunar's first screen tied to one concrete decision (the delayed landing). Already the direction. |
| Impact | Impact counters read 0 in the static read | Show no counter without a source. Already Lunar's rule. |
| Creativity | Red for "dense vegetation" reverses the usual colour meaning | Keep "good/bad" colours conventional and never colour alone. Lunar already pairs colour with text. |
| Validity | Card showed NDVI 0.04 while the text said 0.29 | **Covered:** Lunar already has tests that compare numbers with their text. No new work. |
| Validity | A request went to an `undefined` address | Small optional check: a Lunar build test that fails if a fetched URL string contains `undefined` or `localhost`. Low cost; confirm it is not already in the test suite first. |

### Limits of this audit

Video not played; counters not scrolled into view; the Gemini request headers or key were not inspected; keyboard, mobile, reduced motion not tested.

---

## 3. Astro Sweepers (2025, Galactic Impact)

- **Sources observed:** team page; site https://astro-sweepers.vercel.app/ (routes `/`, `/solution`, `/pricing`, `/sustainability`, `/about`, `/contact`); no repository linked. Depth `runtime-partial`: pages opened and read, forms not submitted, downloads not opened.
- **Version/date:** live 2026-11-15. The site brands itself "AstroSweepersSubmission".

### Strongest idea and what helps a newcomer

- **Strongest move:** the metaphor **"Space Needs A Credit Score."** A big Earth with a faint orange debris cloud, three large numbers (36,000+ trackable objects, 900,000+ smaller fragments, $1T+ assets at risk) and country cards labelled by plain words ("USA 71 – Responsible", "China 48 – Careless", "EU 76 – Responsible", "Russia 52 – Careless"). One familiar idea explains a hard topic in one sentence.
- **Helps a layperson:** the hero reads in seconds; a roadmap tags each capability "Live Today", "In Development" or "Future Vision", which says plainly what exists; pricing starts with a free tier.
- **Observed visual:** near-black background (`rgb(10,10,10)`), Inter, cyan headings and buttons, country cards fading in at the corners of the globe. The documents page uses thumbnail cards of each PDF with a Download button.

### Ledger

| Screen | Action | Observed effect | Evidence | Limit |
| --- | --- | --- | --- | --- |
| Home | Open | A "Project Documents" hub: a folder link "Debris Assessment Software (DAS)" and nine cards (usage agreement, financial model, pricing model, business one-pager, executive summary, 5-year plan, audit report, demo video, team presentation) each with a Download button and file size | screenshot 1 | Downloads not opened |
| Solution | Open | Credit-score hero, four country scores, feature list (Subscription Dashboard, API Access, AI-Powered Predictions, Custom Simulations), an "AI & ML Roadmap" | screenshot 2, text | Descriptions of features; no dashboard was reachable from the site |
| Pricing | Open | Monthly/Yearly toggle, tiers: ASRI Lite (free), ASRI Compliance Pack ($700/mo), more | text | Toggle not exercised |
| Sustainability | Open | "The LEO Accord": a commitment framework citing NASA-STD-8719.14, ISO 24113 and IADC guidelines | text | Standards named by the team, not verified |
| About | Open | Team cards with names, roles and flags | text | none |
| Contact | Read | A form (name, email, company, message) and a placeholder-looking address and phone ("+1 (555) 123-4567", "123 Orbital Way, Satellite City, 90210") | text | Form not submitted |

### What is real and what is only claimed

- **Real (observed):** a polished marketing and documentation site and a set of downloadable documents.
- **Not observed:** the portal and dashboards the team text describes (upload a TLE, receive an assessment, PDF report), the "interactive maps" and the "real-time risk alerts". No input control other than the Contact form was found on the routes visited. The ASRI country scores are shown as fixed cards without a method link in what I read.
- **Disclosed by the site:** a roadmap separating "Live Today" from "In Development" and "Future Vision".

### Screenshots

`astro-1-documents-hub.jpg`, `astro-2-solution-credit-score.jpg`.

### Transfers to Lunar Navigator

| Criterion | Observation | Transfer |
| --- | --- | --- |
| Presentation | One familiar metaphor in the headline ("a credit score") makes an expert topic instantly clear | Lunar can name its question in one everyday sentence in the first screen (it already asks the delayed-landing question). A short metaphor line for "terrain horizon" would be the same move; draft and test with the lead. |
| Relevance | Plain labels beside numbers ("71 – Responsible") | Words next to each metric ("lit most of the time", "long dark gap") using existing thresholds, never a new composite score. |
| Impact | A roadmap separates what exists from what is planned | Lunar's Evidence already separates executed from pending checks; mirror the wording on Home ("Today / Not yet"). |
| Validity | Scores without a visible method | Keep Lunar's rule: no composite index, every number with its definition. |

### Limits of this audit

Forms and downloads not used; no keyboard, mobile or reduced-motion test; the team's own text and the live site differ, and the live site is not the judged version.

---

## 4. Photonics Odyssey (2025, Most Inspirational): deck only, prototype blocked

- **Sources observed:** team page; Canva deck "AakashNet NASA - Presentation" (18 pages, view mode); Drive folder "AakashNet_PhotonicsOdyssey". No prototype URL and no repository are linked.
- **Depth:** `blocked` for the claimed JavaScript prototype (topology, beam switching, throughput views). The Canva deck opened, but its main canvas stayed blank in this session; only the thumbnail strip rendered. The Drive folder showed its title and a sign-in prompt, with no files listed.
- **Observed:** the thumbnails show a dark, space-themed 18-slide deck with a title slide, photos, and several black dashboard-style slides (slides 7 to 10). I did not read slide text, so nothing is claimed about their content.
- **Not inferred:** the prototype, the link-budget results and the "1,280-element" terminal exist only as team text; I did not verify any of them.
- **Screenshot:** `photonics-1-canva-deck-thumbnails.jpg`.
- **Transfer:** none claimed. The honest result is that this winner's project cannot be examined at runtime from the public links.

## 5. Zumorroda-X (2025, Art & Technology): `runtime-partial`, intro scene only

- **Sources observed:** team page; demo https://henrysfarmadventures.vercel.app/ ; the repository `esralsayed/test_farmy` linked on the team page was read statically earlier (`tmp/winners-study-expanded-sonnet.txt`), and its scene file names are the only evidence of later scenes.
- **How far I got:** a loading overlay ("NASA Farming Game … Loading…"), then the game intro scene. The game is a single canvas (1408×792). In this session rendering was very slow: the scene was still fading in about a minute after load, and the dialogue box showed only its speaker tag ("HENRY") with no text yet. Input to the canvas could only be sent as synthetic pointer events; the **SKIP** button reacted (its colour changed on hover), but I did not reach any later scene.

### Strongest idea and what helps a newcomer

- **Strongest move (observed):** a named character and a place. Title "FARMING CRISIS — A Learning Adventure" in a pixel-art typeface, a wide pixel-art landscape (mountains, warm autumn trees, a low sun), the farmer sprite at lower left and a dialogue box beside him. It reads as a story before any data appears.
- **Helps a layperson:** a visible **SKIP** control in the top-right from the first frame, so nobody is trapped in an intro.
- **Observed motion:** a slow fade-in of the whole scene. Other animations were not seen.

### Ledger

| Screen | Action | Observed effect | Evidence | Limit |
| --- | --- | --- | --- | --- |
| Loading | Open | Navy canvas, hidden "Try Again" and "Continue" controls, a loading element | screenshot 1, DOM | Overlay text only |
| Intro scene | Wait | Title bar, landscape, Henry sprite, dialogue box with "HENRY" tag, SKIP button, small progress marks at both bottom corners | screenshots 2 and 3 | Dialogue text not shown within about a minute |
| Intro scene | Synthetic click on SKIP | Button highlight changed; the scene did not change within the window | script, screenshot 3 | Cannot tell whether the click or the slow rendering explains it |

### Not reached, not claimed

The heat map, the flood before/after slider, drought, NDVI map, quizzes, audio and the final scene were **not observed**. The team page text and the repository file names describe them; those are claims, not observations.

### Transfers to Lunar Navigator

| Criterion | Observation | Transfer |
| --- | --- | --- |
| Presentation | A skip control is visible from the very first frame | Lunar's tour already has a visible skip; keep it on every long intro. Covered. |
| Creativity | A named character gives the data a human face | Optional: a single named example persona in the Learn "worked example" (for example "a lander arriving on date X"). Validate with the lead; not a requirement. |

### Limits of this audit

Synthetic input only; very slow rendering; one scene reached; audio, keyboard, mobile and reduced motion not tested. The title shown in game ("Farming Crisis") differs from the team page title ("Henry's Farm Adventures"); I record the difference without drawing a conclusion.

## Open items

- Zumorroda-X: a fuller pass needs real pointer and keyboard input on the canvas and a faster rendering session; only the intro scene was seen.
- HerCode Space ("A Solar Tale") scroll narrative: deferred as a candidate for the next round; it was only inspected statically before.
- HTML dashboard for the user (Portuguese) is built from `tmp/winner-deep-audits/ledger.json`.
