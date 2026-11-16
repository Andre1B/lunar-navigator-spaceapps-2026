# Submission handoff - 2026 form

A prepared handoff that follows the field list of the real 2026 project form as pasted by the user on 15 November 2026. It is not a submission and not an eligibility certification. Dropdown options were not pasted, so none are suggested here. "Save" in the form is not "Submit"; only a reviewed, final Submit by the team counts, before the event deadline (15 November, 23:59 local event time as shown in the form banner).

Official pages: [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) · [Judging and Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) · [Participant Terms](https://www.spaceappschallenge.org/legal/) · [Challenge](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details)

## Project name

Lunacline — lunar arrival comparison (formerly Lunar Navigator)

## Demo (at most 7 slides or 30 seconds; full public URL)

- Video, 29.0 s: https://lunacline.pages.dev/demo/lunar-navigator-demo.mp4 (captions: https://lunacline.pages.dev/demo/lunar-navigator-demo.en.srt)
- Six-slide alternative: https://lunacline.pages.dev/demo/

## Project (full public URL)

- App: https://lunacline.pages.dev/
- Source code: https://github.com/Andre1B/lunar-navigator-spaceapps-2026

lunacline.pages.dev and the former lunar-navigator-2026.pages.dev build from the same repository and were verified serving identical data on 16 November 2026 00:4x UTC; use the lunacline URLs in the form.

## High-level summary

Near the Moon's south pole the Sun circles just above the horizon, so a landing that slips by a few days can put the same spot behind a ridge. Lunacline answers one planning question: if arrival is delayed, does this place still see the Sun and Earth? It compares three arrivals with the same stay and observer height: the original plan, the same place later, and another study point on the delayed date. For six study points from published LOLA polar studies, five observer heights (0.5 to 10 m) and any arrival date in a computed two-year window, it reports how much of the stay has some of the Sun or Earth in view and the longest stretch without direct sunlight, and shows why: each point's real terrain horizon with the Sun's path for both stays, hour-by-hour charts and a light ledger. Example: at Shackleton rim, arriving 9 February 2027 gives 0 hours without direct sunlight; arriving 7 days later gives 140.3 hours, while Connecting ridge stays sunlit. Sun and Earth positions come from NASA NAIF SPICE ephemerides and the terrain from LRO LOLA elevation data (PGDA 5 m and PDS products). Every comparison downloads as a JSON record (and a PDF summary), and an optional 3D view shows the sky behind the numbers. Lunacline supports early, explainable comparison; it does not compute electrical power, guarantee communications or certify landing safety.

## Project details (what, how, benefits, impact, tools, creativity, factors)

**What it does.** Compare holds the stay duration and observer height constant across three scenarios (original arrival, the same place delayed, another study point on the delayed date) and answers with three numbers per scenario: share of the stay with some direct Sun, share with Earth in view, and the longest stretch without direct sunlight. Interactive charts (zoom, pan, exact UTC readouts) show the Sun's path against each point's real horizon and how high the Sun stands above the ridge hour by hour; any instant can be opened in the 3D view.

**How it works.** NASA NAIF SPICE kernels give body positions and lunar orientation. LRO/LOLA PDS and PGDA elevation products give a 720-direction terrain horizon per study point and observer height (0.5, 1, 2, 5, 10 m, each computed, not interpolated). Solar visibility combines terrain blocking and occultation by a spherical Earth over a uniform solar disc; Earth visibility is geometric line of sight. Events are found on a 5-minute grid and refined to about 1 minute; windows touching the computed period are lower bounds. A limited set of Sun/Earth directions is checked against JPL Horizons. A daily GitHub Action recomputes the rolling two-year dataset and redeploys.

**Benefits and impact.** A mission planner, student or reviewer can see in seconds whether a slip in arrival changes sunlight or Earth line of sight at a polar site, and why, with every number traceable to its sources, method and checks (Evidence page) and exportable as a reproducible JSON record.

**Tools.** React, Vite and Three.js (web app); Python, NumPy and SpiceyPy (scientific pipeline); Cloudflare Pages and GitHub Actions (daily data and hosting). Full list with licences: https://lunacline.pages.dev/#/credits and https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/CREDITS.md

**Creativity.** The comparison is framed as one question with three side-by-side answers instead of a map of averages; the "light ledger" and horizon charts make the cause visible; the optional 3D view keeps physical sizes and a shared clock, and labels any illustrative layer.

**Factors considered.** Terrain shadow is distinct from night; Earth visibility is not a radio link; results are geometry, not power or safety; study points are not certified landing sites; coverage is limited to the computed period, with no extrapolation.

## Space Agency data (NASA resources, full public URLs)

- NAIF SPICE generic kernels: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ — specifically https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp, https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc, https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf, https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc, https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls
- LRO LOLA polar gridded data (PDS): https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/ — LDEM_80S_80M and LDEM_75S_240M
- NASA GSFC PGDA LOLA 5 m/pixel south-pole sites: https://pgda.gsfc.nasa.gov/products/78
- NASA SVS CGI Moon Kit (globe colour and elevation): https://svs.gsfc.nasa.gov/4720/
- NASA SVS Deep Star Maps 2020: https://svs.gsfc.nasa.gov/4851/
- NASA SVS Blue Marble Earth imagery: https://svs.gsfc.nasa.gov/12564/
- JPL Horizons (validation only): https://ssd.jpl.nasa.gov/horizons/

## Other data, code, text, images and tools (full public URLs, including free ones)

- Solar System Scope textures, CC BY 4.0 (Sun, planets, Saturn's ring, Earth clouds and specular mask): https://www.solarsystemscope.com/textures/
- Fonts via Fontsource, SIL Open Font License (Overpass, Instrument Serif, IBM Plex Mono, Fira Code): https://fontsource.org/
- Three.js: https://github.com/mrdoob/three.js · React: https://github.com/facebook/react · Vite: https://github.com/vitejs/vite · SpiceyPy: https://github.com/AndrewAnnex/SpiceyPy · NumPy: https://github.com/numpy/numpy
- Demo video: EffectCraft 0.24.1: https://github.com/storytold/effectcraft · Kokoro-82M voice model: https://huggingface.co/hexgrad/Kokoro-82M
- Complete dependency inventory with licences and upstream links: https://lunacline.pages.dev/#/credits

## SI (AI) usage

Claude and Codex assisted research, planning, code, scientific-pipeline implementation, tests, review, interface text, documentation and an original procedural music score. The numerical outputs are calculated deterministically from the cited datasets, not produced by a language model. No AI-generated imagery is deployed as scientific content; illustrative layers (Earth clouds, planet surfaces, the Sun's corona, the opening animation) are credited source material or code and are labelled as illustrative in the app.

Demo video: composed from real captures of the app and its exports. Its narration is the synthetic preset voice `am_michael` of Kokoro-82M (no real or cloned voice; no person appears), and a label stating AI assistance is visible throughout the video. Audio, code and data acknowledgements appear in text in the app (Credits) and in machine-readable metadata: https://lunacline.pages.dev/ai-use.json

The form states that SI answers are collected but not shown to judges, while indicators are. Earlier planning and ideation were AI-assisted; no claim is made here about how any rule on AI-originated ideas applies.

## Gates that need the team, not this handoff

- Team roster, event and deadline timezone as shown in the form.
- Terms and original-human-work confirmations are binding statements made by the team; this handoff does not tick them.
- Check the demo's visible label against the form's wording for SI-generated media before submitting.
- Copy URLs only after opening them; Save is not Submit.
