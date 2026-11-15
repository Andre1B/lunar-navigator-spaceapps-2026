# Submission handoff - 2026-11-15

This is a prepared handoff, not a submitted project or an eligibility certification. The human-readable packet and 29-second storyboard are in the task artifact `lunar-submission-packet`. Official pages were read live on 15 November 2026; their requirements supersede assumptions from earlier years.

## Official sources

- [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- [Judging and Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/)
- [Participant Terms](https://www.spaceappschallenge.org/legal/)
- [Challenge](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details)

## Prepared high-level summary

Lunar Navigator turns a landing delay into a clear comparison: the original arrival, the delayed arrival at the same point, and another point on the delayed date. Using NASA lunar elevation data and ephemerides, it shows when terrain blocks the Sun or Earth, how much of a stay has some visibility, and how long darkness or Earth-visibility gaps last. Visitors can inspect the changing sky, test five observer heights at six study points, and download a sourced PDF. It supports rapid exploration and education; it does not calculate electrical power, guarantee communications or certify landing safety.

## Prepared detailed description

Start with one question: if arrival is delayed, what changes? Home introduces the problem and a real two-arrival experiment. Compare then holds the stay duration and observer height constant across three scenarios, including an alternative point on the delayed date. Short answers precede optional tables, methods and evidence.

NASA NAIF SPICE supplies body positions and lunar orientation. Published LRO/LOLA PDS and PGDA elevation products determine a 720-direction terrain horizon for each computed observer height. The current rolling dataset retains one calendar year before and after its UTC reference date. All six study points and heights 0.5, 1, 2, 5 and 10 metres are computed, rather than interpolated between heights. The selected points are study samples, not NASA-selected or certified landing sites.

Solar visibility combines terrain blocking and geometric occultation by a spherical Earth over a uniform solar disc. It is not a photometric or energy model. Earth visibility describes geometric line of sight, not a radio-link budget or relay service. A limited set of Sun/Earth directions is checked against JPL Horizons, a resource listed by the challenge; this does not externally validate every instant in the rolling period. Executed checks and limitations are published in Evidence.

The simulator uses physical body radii/distances, a terrain-horizon sky view, real-elevation local terrain and a shared faithful astronomical clock. Free experiments are explicitly artificial. The interface separates the percentage of a stay with any visibility from the fraction of a disc visible at an instant. Exports preserve UTC windows, sources, derived-data hashes, assumptions, censored bounds and build identity. PDF and text comparison remain useful without WebGL.

The application uses React, Vite and Three.js; Python, NumPy and SpiceyPy support the deterministic scientific pipeline. Original code is Apache-2.0. NASA assets, other data, fonts, software dependencies and illustrative Earth layers retain their documented terms. Credits, licenses and AI-use metadata are public.

## SI disclosure for the required field

Claude and Codex assisted research, planning, code, scientific-pipeline implementation, tests, review, interface text, documentation and an original procedural score. The numerical outputs are deterministically calculated from cited datasets, not invented by a language model. Private AI-generated design concepts were labeled and are not deployed as scientific imagery. Public imagery is credited source material; generated illustrations are identified. Earlier planning and ideation were AI-assisted. The team's interpretation of the rule restricting AI-originated solution ideas remains unresolved and must not be silently certified. See public/ai-use.json for the detailed record.

## Submission gates requiring human information or assent

Confirm the actual team roster, registration/event and deadline timezone. Local teams require 1-6 members; Universal teams require 2-6. The guide requires English fields and linked materials, a public demo of at most 30 seconds or seven slides, and at least one NASA resource for Global Awards. No public field character limit was observed; verify limits in the actual form rather than inventing one.

Terms/Privacy and original-work/resource-permission confirmations are binding statements; this handoff does not check those boxes. Do not include identifiable minors' names, faces or voices in a demo. Keep source attribution and the unresolved SI-ideation history visible. No submission tag, final eligibility claim or Submit action has been made.

## Demo video

The demo video is published at https://lunar-navigator-2026.pages.dev/demo/lunar-navigator-demo.mp4 (29.000 s, 1920x1080 H.264 + AAC, 9.8 MB) with English captions burned in and as [SRT](https://lunar-navigator-2026.pages.dev/demo/lunar-navigator-demo.en.srt). It shows the question, the three-scenario comparison, the hour-by-hour surface sky at the delayed arrival, the alternative point and the downloadable report, using captures of the public app and its exported PDF and the app's own numbers (Shackleton rim, arrival 2027-02-09, 7-day stay, 1 m, 7-day delay: 0.0 h to 140.3 h without direct sunlight; Connecting ridge 0.0 h).

It was composed in EffectCraft 0.24.1 (MIT OR Apache-2.0). The narration is the generic synthetic preset voice am_michael of Kokoro-82M (Apache-2.0); no real or cloned voice and no person appear. The audio bed is original and synthesized by a project script. "AI-assisted demo" is visible throughout, and tools and licences are listed in CREDITS.md and public/ai-use.json. The six-slide demo at /demo/ remains a valid alternative within the seven-slide limit.
