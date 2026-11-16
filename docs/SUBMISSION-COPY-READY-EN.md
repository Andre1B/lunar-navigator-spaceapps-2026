# Lunacline — copy-ready submission text

The resource links and their NASA / Other classifications remain as listed in SUBMISSION-FORM-FINAL-EN.md. This file revises the narrative fields only. It does not certify eligibility, accept terms or submit the project.

## Project name

Lunacline — Lunar Arrival Comparison

## Project Demonstration

https://lunacline.pages.dev/demo/lunar-navigator-demo.mp4

## Project

https://lunacline.pages.dev/

## Summary

Lunacline turns a delayed lunar arrival into an explainable comparison. Our open-source web application compares the original arrival, the same place later, and another study point on the delayed date, using the same stay and observer height. NASA LRO/LOLA elevation products define each point’s terrain horizon; NASA NAIF SPICE supplies astronomical positions. The application reports the share of the stay with some Sun or Earth visible, the longest stretch without direct sunlight, and the visible portion of each disc at arrival. Horizon charts and an hourly light ledger explain the differences, while an optional 3D view connects the numbers to the sky. Six study points, five observer heights and a documented rolling two-year dataset support exploration. PDF and JSON exports preserve settings, results, sources and limitations. Lunacline helps learners and reviewers understand why arrival time matters without treating sunlight as electrical power, Earth visibility as guaranteed communications, or study points as certified landing sites.

## Project Details

### The problem

Near the Moon’s south pole, a low Sun and an uneven horizon create a planning challenge: delaying arrival can change how long a location receives direct sunlight or keeps Earth in view. Lunacline addresses the Lunar Landing Site Navigator challenge by turning that question into a clear, side-by-side comparison. Comparing arrival scenarios is the main experience; the 3D simulator is an additional way to understand the results.

### What we developed

Our open-source web application compares three scenarios: the original arrival, the same study point after a delay, and an alternative study point on the delayed date. The stay duration and observer height remain consistent across all three. Users can explore six study points, five separately computed heights (0.5, 1, 2, 5 and 10 metres), arrival dates within the published coverage, and delays specified in days and whole hours.

Each scenario reports the percentage of the stay with some direct Sun visible, the percentage with Earth in view, and the longest continuous interval without direct sunlight. Arrival-disc visibility and mean solar-disc visibility are identified separately from time percentages.

Interactive horizon and clearance charts support zoom, pan and exact UTC readouts. An hourly light ledger makes the pattern of light and darkness visible, and chart inspection can open the corresponding instant in 3D. Shareable settings, JSON downloads and a PDF summary make comparisons easier to inspect and reproduce.

### How NASA resources are integrated

NASA LRO/LOLA elevation products distributed through PGDA and PDS provide the terrain used to calculate a 720-direction horizon for each study point and observer height. NASA NAIF SPICE kernels supply astronomical positions, lunar orientation, reference frames and time conversion. The application combines these resources to determine the apparent Sun and Earth positions relative to the local horizon.

Solar visibility accounts jointly for terrain blocking and geometric occultation by a spherical Earth. A five-minute search identifies visibility events, with boundaries refined to approximately one-minute reporting resolution. Selected Sun/Earth directions are checked against JPL Horizons; this limited check does not independently validate every date. NASA SVS imagery supports the visual presentation, while the numerical comparison uses the documented terrain and ephemeris calculations.

A validated GitHub Actions workflow refreshes the rolling dataset, covering one calendar year before and after its UTC reference day. The app does not extrapolate beyond published coverage. Boundary-limited intervals are identified as lower bounds.

### A concrete example

For a seven-day stay at Shackleton rim, at an observer height of 1 metre, arriving on 9 February 2027 produces no modeled interval without direct sunlight. Moving the arrival seven days later changes the longest such interval to approximately 140.3 hours. Connecting ridge, compared on that delayed date with the same stay and height, provides an alternative with no modeled dark interval in that window. These are geometric results for specific study points and settings, not landing recommendations.

### Creativity, benefit and intended impact

Lunacline connects one planning question to three answers, then exposes the reason behind the difference. The horizon chart, light ledger and optional 3D inspection link abstract percentages to terrain and time. This approach aims to make arrival-time trade-offs understandable to students, educators, the public and early-stage mission reviewers without requiring them to navigate several specialist interfaces. Learning outcomes and operational benefits have not yet been measured.

### Tools, reproducibility and limitations

The application uses JavaScript, React, Vite, Three.js/WebGL and the Web Audio API. The scientific pipeline uses Python, NumPy and SpiceyPy/CSPICE. GitHub Actions supports data generation, and Cloudflare Pages hosts the application. The demonstration was composed in EffectCraft, with generic synthetic Kokoro narration and FFmpeg encoding. AI assistance and third-party resources are disclosed in the project credits and metadata.

The model describes geometric visibility, not electrical generation, thermal survival, radio-link quality or landing safety. Earth in view does not guarantee communications. Study points are not certified landing sites. Appearance textures, cloud motion and solar glow are illustrative; short events and unresolved terrain remain limitations.

Public source code: https://github.com/Andre1B/lunar-navigator-spaceapps-2026

Method and reproduction: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/scientific/README.md

Credits and licenses: https://lunacline.pages.dev/#/credits

## Use of Super Intelligence (SI) — explanatory text

Claude and OpenAI Codex assisted research, ideation, planning, interface design, code development, scientific-pipeline implementation, explanatory text, documentation, testing and review under human direction. Astronomical positions, terrain horizons and visibility samples are calculated by deterministic code from the cited NASA resources; a language model did not directly generate those numerical samples.

The 29-second demonstration combines real application captures with AI-assisted animation and a generic synthetic English voice, Kokoro-82M am_puck. It contains no cloned voice or likeness of a real person. The visible watermark “SI-generated video · real app captures” identifies the video throughout. The original procedural music was also developed with AI assistance. Deployed scientific imagery comes from credited sources; illustrative rendering effects are distinguished from measurements.

Usage, media provenance and acknowledgements are documented at https://lunacline.pages.dev/ai-use.json and in the project credits. No claim of competition eligibility is made by this disclosure.

## NASA Data

Keep the existing Link Text / Link URL entries in the NASA Data field. Exact entries are in SUBMISSION-FORM-FINAL-EN.md.

## Space Agency Partner & Other Data

Keep the existing external-resource Link Text / Link URL entries in this separate field. Exact entries are in SUBMISSION-FORM-FINAL-EN.md. The project's own credits and package inventory are complementary documentation, not replacements for external sources.

## Human review — not submission text

Earlier ideation was AI-assisted. The official guide's restriction on SI-originated solution ideas remains an unresolved eligibility issue for the team or organizers to interpret. Do not remove a truthful disclosure, accept legal declarations automatically, or treat saving the form as submitting it for judging.
