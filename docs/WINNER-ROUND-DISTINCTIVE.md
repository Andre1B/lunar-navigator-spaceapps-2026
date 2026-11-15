# Distinctive round: four live NASA products compared with Lunar Navigator

Research date: 2026-11-15. Author: Sonnet agent 464900fb. **None of these four is claimed to be a Space Apps winner.**

## Why not more winners

Every annual global winner from 2012 to 2025 is already in the private 110-record index, so none is "new". People's Choice entries were excluded by earlier rounds. The one source found (the 2015 awards page) lists People's Choice *finalists*, decided by public vote, with no confirmed winner and no project link I could verify, so I did not invent one. The round therefore studies four **live NASA-published products** that answer the same question as Lunar: what does light, terrain and time look like on the Moon, and how do I compare two moments.

## Evidence rules

- **Observed** = read from the live page or its repository today. **Inference** = my reading, not a judge's reason. NASA's criteria are Impact, Creativity, Validity, Relevance and Presentation; I did not invent scores.
- Runtime: one tab of my own in the shared browser, closed by its tabId. Map canvases did not paint in that automated session (blank in screenshots), so **no claim is made about imagery, colour or map rendering**. Keyboard, mobile and reduced motion were **not tested** on any of them.
- No code or assets were copied.

## The four products

| # | Product | Version / date | Primary link | Licence observed |
| --- | --- | --- | --- | --- |
| 1 | NASA Worldview | v6.1 NRT; repo `main` at `1323548` (2026-11-10) | https://worldview.earthdata.nasa.gov/ · https://github.com/nasa-gibs/worldview | NASA Open Source Agreement 1.3 (`LICENSE.md`; GitHub reports "NOASSERTION") |
| 2 | NASA Moon Trek | live, 2026-11-15 | https://trek.nasa.gov/moon/ | not checked; no code read |
| 3 | LROC QuickMap | live, 2026-11-15; moved to https://quickmap.lroc.im-ldi.com/ | https://quickmap.lroc.asu.edu/ | not checked; no code read |
| 4 | NASA SVS "Moon Phase and Libration, 2026" | published 2025-12-11 | https://svs.gsfc.nasa.gov/5587/ | NASA media; not checked beyond the page |

### 1. NASA Worldview (comparison and time)

- **Entry:** a welcome dialog offers a list of "stories" (Introduction to Worldview, Clouds, Hurricane Dorian, and others) and a **Start using Worldview** button. Observed.
- **Compare:** **Start Comparison** announces "You are now in comparison mode." and adds **A: 2026 NOV 15** and **B: 2026 NOV 08** (B defaults to one week earlier). Types: **Swipe, Opacity, Spy**. Exit Comparison is one button. Observed.
- **State in the URL:** the address becomes `?l1=…&ca=true&t=2026-11-15-T13:06:20Z&t1=2026-11-08-T13:06:20Z`. Observed.
- **Timeline:** year/month/day increment buttons, a ruler with **A and B markers**, a "latest available date" button, "Set up animation", "Take a snapshot", "Share this map". Observed.
- **Keyboard:** the repository documents arrows to move the time interval, Shift+T (now), Shift+D (distraction-free), Space (play/pause), Esc. This is **documentation read, not tested**.
- **Visual:** dark chrome, a white swipe line with a circular handle carrying A/B date tags, A/B pills above the layer list. Observed in a screenshot (map tiles blank).
- **Limits:** imagery not rendered here; data is Earth observation, not Moon.

### 2. NASA Moon Trek (lunar tools and sharing)

- **Entry:** a welcome dialog with **Start Tutorial / Skip Tutorial**. Observed.
- **Tools named in the interface:** Calculate Sun Angle, Surface Lighting, Line of Sight, Slope, Calculate Elevation Profile, Data Plotter, Subsetting, MoonDiff, Detect Craters. Observed as labels only; I did not run them.
- **Access rule (page text):** all data and basic functionality are public; "advanced tools … (e.g., lighting, slope analysis) require a registered individual or group account". Observed.
- **Share:** **Share Link** and **Screen Capture** exist; the URL hash carries view, zoom and projection. Observed.
- **Views:** 3D Globe, 2D Map, North/South Pole Map. Observed.
- **Limits:** 3D was open only about a minute, to spare the GPU. Tool results were not seen.

### 3. LROC QuickMap (time bar and shared state)

- **Entry:** a notice that the site "moved to Intuitive Machines" and the old address will be retired; layer browser redesigned. Observed.
- **Time bar:** transport (previous, pause, next), loop, speed **1x**, a **UTC clock** (2026-11-15 13:47:58 UTC) and a ruler with weekly ticks. Observed.
- **Readouts:** LAT, LON, RES and an Accuracy toggle at the bottom left; search box accepts "lat,lon[,height]". Observed.
- **Shared state:** URL carries projection, layer stack and compressed definitions; a Share button exists. Observed.
- **Limits:** the "Visibility Analysis" label did not open a tool in my pass; the map canvas stayed blank.

### 4. NASA SVS Moon Phase and Libration (one clear picture of time)

- **What it is:** an hourly animation of geocentric phase, libration, axis position angle and apparent size for the year, plus phase stills and videos (360p to 2160p). Observed.
- **Teaching:** explains libration ("a month compressed into 24 seconds … looks like it's wobbling"), defines the **sub-Earth point** as "the location on the Moon where the Earth is directly overhead", and explains perigee/apogee (up to 14% size difference). Observed.
- **Use of data:** credits LRO LOLA and LROC maps. Observed.
- **Limits:** a video, not an interactive tool; Earth-centred, not site-specific.

## What is memorable and useful (inference)

- **Worldview:** the whole comparison is *two dates and one handle*. The user never fills a form to compare.
- **Moon Trek and QuickMap:** every view can be sent to someone else as a link.
- **QuickMap and Worldview:** time is always visible as a UTC clock plus a ruler, with the current moment marked.
- **SVS:** one sentence defines the key term ("Earth directly overhead") before the picture uses it.

## Gaps in the current Lunar, by criterion

I checked the code: `src/App.jsx` only **reads** `?metric=` from the hash; the selected point, height, arrival, window, delay and alternative are not written to the URL. There is a JSON export (`ExportComparison`) and an `aria-live` region for constraint results. I found no azimuth-ruler or A/B markers on the timeline in the files I grepped.

| Criterion | Gap | Product that shows the pattern |
| --- | --- | --- |
| Impact | A comparison cannot be sent to another person as a link | Worldview, Moon Trek, QuickMap |
| Creativity | "Original" and "delayed" arrival are not shown as two movable markers on one light timeline | Worldview A/B pins |
| Validity | Readers cannot tell which moment each number belongs to without reading the table | QuickMap UTC clock + ruler |
| Relevance | The page does not define "Earth overhead" in one sentence next to the Earth track | SVS sub-Earth point |
| Presentation | Mode changes are not announced to screen readers | Worldview "You are now in comparison mode." |

## Proposals (ranked, no new physics, no copied assets)

1. **Shareable comparison link.** Write point, height, arrival, window, delay and alternative to the hash; restore on load; add "Copy link". Acceptance: opening the link reproduces identical numbers in Compare; a test compares exported JSON from both.
2. **A/B markers on the hourly light bar.** Pins labelled "Original arrival" and "Delayed arrival" with UTC dates on the Horizon Ledger time bar, draggable or keyboard-adjustable. Acceptance: pin positions equal the existing scenario start times.
3. **Live announcement.** An `aria-live="polite"` message when the user changes scenario or mode ("Comparing original and delayed arrival, same 7-day window"). Acceptance: text matches the current scenario.
4. **UTC ruler with week ticks and a labelled cursor** on the bar, as QuickMap does. Acceptance: the cursor label equals the sample time already used by the simulator.
5. **One-sentence definition of "Earth overhead"** (sub-Earth point) beside the Earth track and in Learn, in plain English.

Items 1 to 3 use data Lunar already computes. Do not add a "safest window" recommendation or a composite score; that stays out of scope.

## Limits of this round

- No winner was added; that universe is exhausted, as stated above.
- Runtime evidence covers entry, compare setup, URL state and timeline labels only. Map rendering, colour, motion, keyboard flow, mobile and reduced motion were not tested.
- Moon Trek and QuickMap licences and code were not read.
- Worldview's licence file is read; the keyboard list is documentation, not a tested behaviour.
- Private evidence: `tmp/winner-round-distinctive/` (two screenshots, SVS page copy, ledger). Index records added under `roundStudies` in `tmp/research-index.json`.
