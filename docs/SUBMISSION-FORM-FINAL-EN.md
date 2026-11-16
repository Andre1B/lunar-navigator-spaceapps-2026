# Lunacline — final English submission field text

Prepared 2026-11-16 UTC / 2026-11-15 America/Sao_Paulo by independent reviewer 7e2bdfb8 (GPT-6.1 Sol high). This is a copy-and-paste handoff, not a submitted project, an eligibility decision or a new release verification. Only this document is owned by this task. The video and SUBMISSION-PACKET.md remain with Claude.

## Release state — read before copying

- Public project URL: https://lunacline.pages.dev/ . Former URL: https://lunar-navigator-2026.pages.dev/ . The release owner confirmed the app build below is live; later assets still need their own confirmation.
- Updated release checkpoint: root/Claude confirmed the application built from `9e73651b098b1179f80e4e13ea05e389100d8636` published at lunacline.pages.dev. This author independently observed compiled HTML, the current manifest and AI metadata over HTTP, not a full functional release test. Follow-up `9790e01` updates active URLs/README/release notes and was propagating when reported; do not automatically treat that later revision or a new video as verified published content.
- Local manifest: generated 2026-11-16T00:35:50Z; reference day 2026-11-16; coverage 2025-11-16 through 2027-11-16 UTC, inclusive stored endpoints; five heights 0.5, 1, 2, 5 and 10 m. Coverage changes with validated daily refreshes; use the live Computed dates notice rather than promising these dates indefinitely.
- Published video (v4, commit d02f47b, verified live 2026-11-16 ~01:45 UTC): https://lunacline.pages.dev/demo/lunar-navigator-demo.mp4 — 29.0 s, 1920x1080 H.264 + AAC, 6,762,185 bytes, synthetic generic Kokoro-82M voice `am_puck`, "SI-generated video · real app captures" visible on every frame, English captions at https://lunacline.pages.dev/demo/lunar-navigator-demo.en.srt. The earlier version used `am_michael`.
- Historical Lighthouse results in VERIFICATION.md/release-evidence.json refer to their named older revisions and environments. They do not certify the current published revision or a later candidate. No current ≥90, universal smoothness, physical-phone, browser-completeness or comprehension claim is included below.
- This pass reads code, metadata and public guidance. It runs no GPU exercise, application build, tests or deployment. Live access observations and source matches are distinguished below; a listed upstream URL is not a newly downloaded or revalidated data file.

## Project name

Lunacline — lunar arrival comparison

## Link to final project

https://lunacline.pages.dev/

Public source repository: https://github.com/Andre1B/lunar-navigator-spaceapps-2026

## Link to project demo — release owner selects the verified public asset

Published-video path: https://lunacline.pages.dev/demo/lunar-navigator-demo.mp4

English captions: https://lunacline.pages.dev/demo/lunar-navigator-demo.en.srt

Six-slide alternative: https://lunacline.pages.dev/demo/

The official guide permits a video of at most 30 seconds or a deck of at most seven slides. The existing documentation describes a 29-second video and six-slide deck; the published video v4 was measured at 29.0 s (ffprobe) before upload. Select one verified public demo link, not a private editable project or voice sample.

## High-level project summary

Lunacline turns a delayed lunar arrival into an explainable comparison. Our open-source web application compares the original arrival, the same place later, and another study point on the delayed date, using the same stay and observer height. NASA LRO/LOLA elevation products define each point’s terrain horizon; NASA NAIF SPICE supplies astronomical positions. The application reports the share of the stay with some Sun or Earth visible, the longest stretch without direct sunlight, and the visible portion of each disc at arrival. Horizon charts and an hourly light ledger explain the differences, while an optional 3D view connects the numbers to the sky. Six study points, five observer heights and a documented rolling two-year dataset support exploration. PDF and JSON exports preserve settings, results, sources and limitations. Lunacline helps learners and reviewers understand why arrival time matters without treating sunlight as electrical power, Earth visibility as guaranteed communications, or study points as certified landing sites.

Word count: 154 (whitespace-delimited words, body only; within the requested 50–200-word range).

## Project details — copy this section's body

### The question and the product

If arrival near the Moon's south pole is delayed, will the same location still see the Sun and Earth during the planned stay? The low polar Sun makes the local terrain horizon important: arriving later can place the Sun behind a different ridge. Lunacline, developed by Team An0r4k for the Lunar Landing Site Navigator challenge, makes that change visible and inspectable. Comparing arrival times is the primary product; the 3D view is an optional explanation of its results.

Visitors set a study point, observer height, arrival date, stay and delay, then compare three scenarios: the original arrival, the same point later, and another point on the delayed date. The stay and observer height remain the same across the scenarios. The supported points are Connecting ridge, Shackleton rim, Nobile rim 1, Malapert massif and two fixed-offset neighboring points. They are study points on published terrain, not NASA-selected or certified landing sites. Five separately computed observer heights are available: 0.5, 1, 2, 5 and 10 metres above the DEM surface. A low model observer does not imply equivalent terrain accuracy.

### What visitors see and can keep

The main results distinguish time from disc area: the share of the stay when any part of the Sun is visible, the share when any part of Earth is visible, the longest continuous period without direct sunlight, and the unblocked part of each disc at the arrival instant. Detailed measurements add the mean solar-disc fraction and longest Earth-visibility gap. Intervals touching a comparison-window boundary are shown as lower bounds, not complete durations. Invalid or out-of-coverage windows are not extrapolated.

The computed horizon, separate Sun tracks and hourly light ledger explain how the two stays differ. A comparison can be shared through a link containing settings; reopening it uses the dataset available then. Local PDF and JSON downloads preserve the calculation's settings, results, source information and limitations. They provide an inspectable record rather than a ranking of safe landing sites. Guided analysis, educational lessons and unrestricted routes support both a short review and a longer investigation. No login or completion of a game is required.

The optional 3D view uses ephemeris-driven positions and physical body radii/distances. Surface sky shows apparent angular sizes and the computed terrain horizon; its foreground terrain is visual geometry, with attributed surface imagery and explicitly illustrative rendering effects. Faithful Mode shares astronomical time. Free Mode independently freezes selected motions for clearly labeled artificial experiments; those freezes do not change the faithful comparison or supply mission recommendations.

### How the calculations work

An offline Python pipeline combines NASA LRO/LOLA topography from NASA Goddard PGDA and the PDS Geosciences archive with NASA JPL NAIF SPICE kernels. It traces a 720-direction terrain horizon for each supported height using the documented lunar frame, projection and elevation datum. Sun and Earth geometry uses the stated apparent airless conventions. Solar visibility jointly accounts for the terrain cut and occultation by an opaque spherical Earth; it does not multiply unrelated percentages. The solar disc is uniform, without atmospheric transmission or limb darkening.

The static dataset covers one calendar year before and after its UTC reference day and is refreshed through a documented, validated daily generation workflow. It publishes hourly samples, a five-minute event search with refined boundaries, conventions, source hashes and validation evidence. Short events can be missed. Comparison means are hourly approximations; event-based durations have their own stated resolution. Nothing extends beyond the published coverage at runtime.

Executed scientific checks are published with the data. They include selected JPL Horizons comparisons, terrain datum/registration and horizon-range checks, illumination reproduction checks, geometric eclipse-area checks and coverage consistency. The Horizons reference checks sample five historical instants per Sun/Earth/site combination; they do not independently validate every date in the rolling window or the visual planets. The Evidence screen and scientific README expose those limits.

### Original contribution, intended benefit and limits

Our contribution is the connected explanation: hold the mission assumptions constant, change arrival time, see the numerical consequence, inspect the terrain reason and export the evidence. The interface separates time-in-view from visible disc area, highlights censored intervals and keeps exploration distinct from operational advice. Public source and provenance make the reasoning easier to audit and reproduce. We aim to help students, educators and early-stage reviewers ask better questions about arrival-time trade-offs; we have not established operational benefit or measured novice learning outcomes.

Sunlight visibility is not solar irradiance, electrical generation, battery survival or thermal analysis. Seeing part of Earth is not a radio link budget, antenna solution, relay plan or DSN guarantee. The model does not resolve boulders or all subpixel relief, assess landing hazards, design trajectories or certify safety. Historical Earth imagery, illustrative clouds, planet appearance, glare, music and the opening are not forecasts or additional measurements. NASA does not author, endorse or certify this prototype.

### Tools, source and assistance

The application uses JavaScript, React, Vite, Three.js/WebGL, native Web Audio and jsPDF. The scientific pipeline uses Python, NumPy, SpiceyPy/CSPICE and tifffile, with documented optional asset-conversion tools. GitHub Actions supports validated data generation and Cloudflare Pages hosts the static application. Charts, comparison presentation, calendar, procedural score and opening are original project code. Third-party software, textures, fonts and data retain their own licenses and credits.

Source: https://github.com/Andre1B/lunar-navigator-spaceapps-2026 . Original code is Apache-2.0. Detailed credits and upstream links: https://lunacline.pages.dev/#/credits . Scientific method and reproduction: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/scientific/README.md . AI assistance is disclosed in the following field and in https://lunacline.pages.dev/ai-use.json ; no claim of resolved competition eligibility is made.

## SI / AI use — explanatory text only; do not invent a dropdown choice

Claude and Codex assisted research, planning, implementation, explanatory text, documentation, debugging, testing and review under human direction. The scientific samples are produced by deterministic code from the cited NASA/NAIF elevation and ephemeris resources; language models did not invent or manually supply those samples. Privately labeled generated UI concepts informed the design and are not shipped as scientific imagery. The opening and rendering effects are original code illustrations, not measured scenes. The original procedural music is AI-assisted composition and implementation, acknowledged in credits and metadata; it is not scientific sonification.

The currently documented public demo is AI-assisted and visibly labeled. It uses real application captures and the generic synthetic Kokoro-82M preset `am_puck` (the earlier version used `am_michael`), not a cloned voice or a likeness of a real person, and shows "SI-generated video · real app captures" on every frame. Assistance and media provenance: https://lunacline.pages.dev/ai-use.json and https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/CREDITS.md .

Earlier ideation and planning were AI-assisted. The team has not established that this history satisfies the official restriction on using SI to originate the solution idea. We disclose this unresolved issue rather than claiming compliance or eligibility.

## Official-guidance basis and unresolved human decision

Read live on 2026-11-16 UTC: https://www.spaceappschallenge.org/resources/project-submission-guide/ , section Project Page Form Field Instructions → Use of Super Intelligence (SI). Its current wording includes: “SI should not be used to (come up with your idea of how to solve the challenge).” This short quotation is literal, including the parenthesis; do not silently repair it or claim an exception. The same section requires disclosure of where/how SI was used. The documented earlier AI-assisted ideation creates a factual unresolved issue requiring the team's/organizer's interpretation. This does not prevent preparing honest text or a labeled video; it prevents an unsupported compliance claim.

No SI dropdown option, award, judges' opinion, eligibility finding, legal assent or submission confirmation is invented. Team/event confirmation, binding terms/original-work declarations, and any final submission action belong to the human team. The guide distinguishes saving from submitting and requires public, accessible links and English materials. Guide: https://www.spaceappschallenge.org/resources/project-submission-guide/ . Terms: https://www.spaceappschallenge.org/legal/ . Challenge: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details .

## NASA Data — Link Text / URL entries

The following entries distinguish numerical inputs, validation references, visual assets and contextual tools. Exact URLs are matched to repository provenance; this task did not download bulk data.

Link Text: NASA PGDA high-resolution south-pole topography (product 78)

URL: https://pgda.gsfc.nasa.gov/products/78

Use: 5 m DEMs and published Site01/Site04 regions of interest; four unique source DEMs support six study points.

Source match: CREDITS.md; scientific/README.md; corresponding public asset metadata.

Link Text: NASA LOLA / PDS polar gridded elevation data

URL: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/

Use: Mid/far terrain, datum and projection metadata.

Source match: CREDITS.md; scientific/README.md; corresponding public asset metadata.

Link Text: NASA NAIF SPICE generic kernels

URL: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/

Use: Astronomical positions, lunar orientation, frames, time conversion and reference constants; also visual planet context.

Source match: CREDITS.md; scientific/README.md; corresponding public asset metadata.

Link Text: NASA JPL Horizons

URL: https://ssd.jpl.nasa.gov/horizons/

Use: Sampled independent Sun/Earth references, six sites/two bodies/five historical instants. Twelve cached responses; not validation of all rolling dates or planets.

Source match: CREDITS.md; scientific/README.md; corresponding public asset metadata.

Link Text: NASA PGDA lunar illumination study (product 69)

URL: https://pgda.gsfc.nasa.gov/products/69

Use: Published illumination context and side-by-side validation reference.

Source match: CREDITS.md; scientific/README.md; corresponding public asset metadata.

Link Text: NASA SVS CGI Moon Kit

URL: https://svs.gsfc.nasa.gov/4720/

Use: LROC lunar color and LOLA global visual relief; not a replacement for the numerical polar terrain horizon.

Source match: CREDITS.md; scientific/README.md; corresponding public asset metadata.

Link Text: NASA SVS Blue Marble Next Generation

URL: https://svs.gsfc.nasa.gov/12564/

Use: Historical March 2004 Earth ground appearance; NASA/GSFC and Reto Stockli. Not simulated-date weather.

Source match: CREDITS.md; scientific/README.md; corresponding public asset metadata.

Link Text: NASA SVS Deep Star Maps 2020

URL: https://svs.gsfc.nasa.gov/4851/

Use: Catalogue-based star background; NASA/Goddard SVS and ESA/Gaia/DPAC, Gaia DR2. No separate Gaia catalogue downloaded; brightness illustrative.

Source match: CREDITS.md; scientific/README.md; corresponding public asset metadata.

### Exact numerical input files and companion labels

All 17 entries are pinned in scientific/source-lock.json.

Link Text: NASA naif0012.tls

URL: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls

Use: Pinned NAIF kernel for positions, frames, orientation, radii or UTC conversion.

Source match: scientific/source-lock.json: kernels/naif0012.tls.

Link Text: NASA pck00011.tpc

URL: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc

Use: Pinned NAIF kernel for positions, frames, orientation, radii or UTC conversion.

Source match: scientific/source-lock.json: kernels/pck00011.tpc.

Link Text: NASA de440s.bsp

URL: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp

Use: Pinned NAIF kernel for positions, frames, orientation, radii or UTC conversion.

Source match: scientific/source-lock.json: kernels/de440s.bsp.

Link Text: NASA moon_pa_de440_200625.bpc

URL: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc

Use: Pinned NAIF kernel for positions, frames, orientation, radii or UTC conversion.

Source match: scientific/source-lock.json: kernels/moon_pa_de440_200625.bpc.

Link Text: NASA moon_de440_250416.tf

URL: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf

Use: Pinned NAIF kernel for positions, frames, orientation, radii or UTC conversion.

Source match: scientific/source-lock.json: kernels/moon_de440_250416.tf.

Link Text: NASA LDEM_80S_80M.IMG

URL: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG

Use: Numerical terrain/ephemeris input.

Source match: scientific/source-lock.json: dem/LDEM_80S_80M.IMG.

Link Text: NASA LDEM_75S_240M.IMG

URL: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.IMG

Use: Numerical terrain/ephemeris input.

Source match: scientific/source-lock.json: dem/LDEM_75S_240M.IMG.

Link Text: NASA Site01_final_adj_5mpp_surf.tif

URL: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif

Use: PGDA 5 m adjusted surface DEM used for terrain horizons and visual terrain derivatives.

Source match: scientific/source-lock.json: dem/Site01/Site01_final_adj_5mpp_surf.tif.

Link Text: NASA Site04_final_adj_5mpp_surf.tif

URL: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif

Use: PGDA 5 m adjusted surface DEM used for terrain horizons and visual terrain derivatives.

Source match: scientific/source-lock.json: dem/Site04/Site04_final_adj_5mpp_surf.tif.

Link Text: NASA Site06_final_adj_5mpp_surf.tif

URL: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site06/Site06_final_adj_5mpp_surf.tif

Use: PGDA 5 m adjusted surface DEM used for terrain horizons and visual terrain derivatives.

Source match: scientific/source-lock.json: dem/Site06/Site06_final_adj_5mpp_surf.tif.

Link Text: NASA Site23_final_adj_5mpp_surf.tif

URL: https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site23/Site23_final_adj_5mpp_surf.tif

Use: PGDA 5 m adjusted surface DEM used for terrain horizons and visual terrain derivatives.

Source match: scientific/source-lock.json: dem/Site23/Site23_final_adj_5mpp_surf.tif.

Link Text: NASA AVGVISIB_85S_060M_201608.IMG

URL: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608.IMG

Use: Long-term average-illumination map used in point selection/validation, not a stay forecast.

Source match: scientific/source-lock.json: dem/AVGVISIB_85S_060M_201608.IMG.

Link Text: NASA LPSR_85S_060M_201608.IMG

URL: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/LPSR_85S_060M_201608.IMG

Use: Permanently shadowed-region map used in validation.

Source match: scientific/source-lock.json: dem/LPSR_85S_060M_201608.IMG.

Link Text: NASA LDEM_80S_80M.LBL

URL: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.LBL

Use: Companion PDS encoding, registration and datum label; not another measurement.

Source match: scientific/source-lock.json: dem/LDEM_80S_80M.LBL.

Link Text: NASA LDEM_75S_240M.LBL

URL: https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_75S_240M.LBL

Use: Companion PDS encoding, registration and datum label; not another measurement.

Source match: scientific/source-lock.json: dem/LDEM_75S_240M.LBL.

Link Text: NASA AVGVISIB_85S_060M_201608.LBL

URL: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_85S_060M_201608.LBL

Use: Companion PDS encoding, registration and datum label; not another measurement.

Source match: scientific/source-lock.json: dem/AVGVISIB_85S_060M_201608.LBL.

Link Text: NASA LPSR_85S_060M_201608.LBL

URL: https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/LPSR_85S_060M_201608.LBL

Use: Companion PDS encoding, registration and datum label; not another measurement.

Source match: scientific/source-lock.json: dem/LPSR_85S_060M_201608.LBL.

### Exact visual input files and contextual tools

Link Text: NASA global lunar displacement ldem_4.tif

URL: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif

Use: LOLA-derived visual global relief, documented resampling.

Source match: public/data/globe/moon-elevation.json.

Link Text: NASA LROC 16-bit 4k color map

URL: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif

Use: Source of current lunar JPEG/mobile conversions; NASA SVS/LROC/ASU credit.

Source match: public/data/globe/visual-assets.json.

Link Text: NASA retained 2k lunar color asset

URL: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg

Use: Historical/fallback asset, distinct from the current 4k source.

Source match: public/assets/PROVENANCE.json.

Link Text: NASA March 2004 Blue Marble input

URL: https://svs.gsfc.nasa.gov/vis/a010000/a012500/a012564/frames/5400x2700_2x1_60p/world.topo.2004-03.png

Use: Historical Earth ground composite, converted to JPEG/mobile sizes.

Source match: public/assets/PROVENANCE.json.

Link Text: NASA Deep Star Maps 2020 EXR

URL: https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr

Use: Visual star background conversion; ESA/Gaia/DPAC credit retained.

Source match: public/data/starmap/starmap.json.

Link Text: NASA Moon Trek

URL: https://trek.nasa.gov/moon/

Use: Contextual exploration reference; no application code imported.

Source match: CREDITS.md.

Link Text: LROC QuickMap

URL: https://quickmap.lroc.im-ldi.com/

Use: Contextual exploration reference; not a runtime numerical source.

Source match: CREDITS.md.

## Other Data and References — Link Text / URL entries

Specific reused assets/software and methodological/contextual references follow. Numerical inputs, appearance, tools and inspiration are separate; no competitor code, images or music were imported.

### Appearance assets

Link Text: Solar System Scope textures

URL: https://www.solarsystemscope.com/textures/

Use: Illustrative Sun/planet/ring appearance, CC BY 4.0; based on NASA imagery, not live data.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_sun.jpg

URL: https://www.solarsystemscope.com/textures/download/2k_sun.jpg

Use: CC BY 4.0; resized to 1024x512, JPEG quality 82. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_mercury.jpg

URL: https://www.solarsystemscope.com/textures/download/2k_mercury.jpg

Use: CC BY 4.0; resized to 1024x512, JPEG quality 82. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_venus_atmosphere.jpg

URL: https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg

Use: CC BY 4.0; resized to 1024x512, JPEG quality 82. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_mars.jpg

URL: https://www.solarsystemscope.com/textures/download/2k_mars.jpg

Use: CC BY 4.0; resized to 1024x512, JPEG quality 82. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_jupiter.jpg

URL: https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg

Use: CC BY 4.0; resized to 1024x512, JPEG quality 82. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_saturn.jpg

URL: https://www.solarsystemscope.com/textures/download/2k_saturn.jpg

Use: CC BY 4.0; resized to 1024x512, JPEG quality 82. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_uranus.jpg

URL: https://www.solarsystemscope.com/textures/download/2k_uranus.jpg

Use: CC BY 4.0; resized to 1024x512, JPEG quality 82. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_neptune.jpg

URL: https://www.solarsystemscope.com/textures/download/2k_neptune.jpg

Use: CC BY 4.0; resized to 1024x512, JPEG quality 82. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope 2k_saturn_ring_alpha.png

URL: https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png

Use: CC BY 4.0; re-saved PNG, unchanged pixels. Appearance only.

Source match: public/assets/planets/PROVENANCE.json.

Link Text: Solar System Scope Earth cloud/specular collection

URL: https://extension.solarsystemscope.com/textures/

Use: CC BY 4.0 greyscale opacity/specular derivatives over separate NASA Blue Marble ground; clouds are illustrative, not weather.

Source match: public/data/globe/earth-layers.json.

Link Text: Solar System Scope Earth cloud source

URL: https://extension.solarsystemscope.com/textures/download/2k_earth_clouds.jpg

Use: Converted to greyscale JPEG; CC BY 4.0 attribution/changes preserved.

Source match: public/data/globe/earth-layers.json.

Link Text: Solar System Scope Earth ocean-specular source

URL: https://extension.solarsystemscope.com/textures/download/2k_earth_specular_map.tif

Use: Converted to greyscale JPEG; CC BY 4.0 attribution/changes preserved.

Source match: public/data/globe/earth-layers.json.

Link Text: Creative Commons Attribution 4.0

URL: https://creativecommons.org/licenses/by/4.0/

Use: Solar System Scope asset/adaptation license; not relicensed as original Apache-2.0 code.

Source match: Earth/planet provenance.

### Application and verification software

Link Text: @fontsource/fira-code 5.3.0

URL: https://github.com/fontsource/font-files

Use: Application/build/verification dependency. License: OFL-1.1. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: @fontsource/ibm-plex-mono 5.3.0

URL: https://github.com/fontsource/font-files

Use: Application/build/verification dependency. License: OFL-1.1. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: @fontsource/instrument-serif 5.3.0

URL: https://github.com/fontsource/font-files

Use: Application/build/verification dependency. License: OFL-1.1. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: @fontsource/overpass 5.3.0

URL: https://github.com/fontsource/font-files

Use: Application/build/verification dependency. License: OFL-1.1. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: @vitejs/plugin-react 6.3.0

URL: https://github.com/vitejs/vite-plugin-react

Use: Application/build/verification dependency. License: MIT. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: jspdf 4.2.1

URL: https://github.com/parallax/jsPDF

Use: Application/build/verification dependency. License: MIT. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: lighthouse 13.6.0

URL: https://github.com/GoogleChrome/lighthouse

Use: Application/build/verification dependency. License: Apache-2.0. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: playwright 1.65.1

URL: https://github.com/microsoft/playwright

Use: Application/build/verification dependency. License: Apache-2.0. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: prettier 3.10.1

URL: https://github.com/prettier/prettier

Use: Application/build/verification dependency. License: MIT. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: react 19.3.1

URL: https://github.com/react/react

Use: Application/build/verification dependency. License: MIT. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: react-dom 19.3.1

URL: https://github.com/react/react

Use: Application/build/verification dependency. License: MIT. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: three 0.187.0

URL: https://github.com/mrdoob/three.js

Use: Application/build/verification dependency. License: MIT. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: vite 8.3.8

URL: https://github.com/vitejs/vite

Use: Application/build/verification dependency. License: MIT. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: wrangler 4.162.0

URL: https://github.com/cloudflare/workers-sdk

Use: Application/build/verification dependency. License: MIT OR Apache-2.0. Auditing-tool use is not a current passing performance claim.

Source match: package.json; public/credits.json.

Link Text: FontTools

URL: https://github.com/fonttools/fonttools

Use: Convert installed Overpass WOFF2 into report TTF; outlines and OFL notices preserved; MIT.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: GitHub Actions checkout

URL: https://github.com/actions/checkout

Use: Clean-checkout verification tooling; not a scientific or browser dependency; MIT.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: GitHub Actions setup-node

URL: https://github.com/actions/setup-node

Use: Pinned Node.js CI environment; not a scientific or browser dependency; MIT.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: Pillow

URL: https://github.com/python-pillow/Pillow

Use: Resizing and encoding credited visual assets; HPND.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: OpenEXR

URL: https://github.com/AcademySoftwareFoundation/openexr

Use: Reading the NASA star-map source; BSD-3-Clause.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: imagecodecs

URL: https://github.com/cgohlke/imagecodecs

Use: Decoding the source LROC TIFF; BSD-3-Clause.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: Python

URL: https://github.com/python/cpython

Use: Scientific runtime; PSF License.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: NumPy

URL: https://github.com/numpy/numpy

Use: Numerical arrays; BSD-3-Clause.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: SpiceyPy

URL: https://github.com/AndrewAnnex/SpiceyPy

Use: Astronomical geometry; MIT; bundled CSPICE retains NAIF terms.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: tifffile

URL: https://github.com/cgohlke/tifffile

Use: Terrain raster reading; BSD-3-Clause.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: PyShp

URL: https://github.com/GeospatialPython/pyshp

Use: One-time exploration of published ROI shapefiles; MIT.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: Overpass

URL: https://github.com/RedHatOfficial/Overpass

Use: Interface typography; SIL Open Font License 1.1.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: Fira Code

URL: https://github.com/tonsky/FiraCode

Use: Numerical typography; SIL Open Font License 1.1.

Source match: src/lib/content.js; CREDITS.md; scientific/requirements.txt.

Link Text: FontTools

URL: https://github.com/fonttools/fonttools

Use: Optional report font conversion, MIT; original font notices retained.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: Instrument Serif

URL: https://github.com/Instrument/instrument-serif

Use: Display typeface, SIL OFL 1.1.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: IBM Plex Mono

URL: https://github.com/IBM/plex

Use: Monospace typeface, SIL OFL 1.1.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: Fontsource

URL: https://github.com/fontsource/fontsource

Use: Self-hosted font distribution; fonts retain upstream OFL.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: EffectCraft

URL: https://github.com/storytold/effectcraft

Use: Recorded demo composer 0.24.1, MIT OR Apache-2.0.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: Kokoro-82M

URL: https://huggingface.co/hexgrad/Kokoro-82M

Use: Synthetic narration, Apache-2.0. Published v4 uses am_puck; the earlier version used am_michael.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: faster-whisper

URL: https://github.com/SYSTRAN/faster-whisper

Use: Local demo narration/timing check, MIT; upstream URL checked live.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: FFmpeg

URL: https://ffmpeg.org/

Use: Demo encode with libx264; terms depend on build/components. Encoder binary is not bundled in the web app.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: OpenAI Codex

URL: https://openai.com/codex/

Use: AI assistance disclosed in ai-use.json; service/model terms, no shipped model weights; official product URL checked.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: Anthropic Claude

URL: https://www.anthropic.com/claude

Use: AI assistance disclosed in ai-use.json; official product URL redirects to Claude product overview.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: Canadian Space Agency Moon exploration

URL: https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/

Use: Educational context only, not a numerical input.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: Official Space Apps event logo

URL: https://drive.google.com/file/d/1UP7H6w3Te5Ja4n0vscKjWot2buCc-FqT/view

Use: Unmodified organizer asset, event identification only. Brand rights reserved; not the Lunacline mark, not an endorsement.

Source match: CREDITS.md; public/ai-use.json; public/assets/PROVENANCE.json, as applicable.

Link Text: kokoro synthesis package

URL: https://github.com/hexgrad/kokoro

Use: Local synthetic speech generation; Apache-2.0. This is the implementation package, distinct from the Kokoro-82M model link above.

Source match: CREDITS.md and the installed kokoro package METADATA homepage/repository; public upstream observed.

Link Text: Inter typeface

URL: https://github.com/rsms/inter

Use: Bundled demo typeface; SIL OFL 1.1. Distinct from the web app's four self-hosted families.

Source match: CREDITS.md demo section; official upstream repository observed.

Link Text: SciPy

URL: https://github.com/scipy/scipy

Use: Original demo/audio-script processing; BSD-3-Clause project, with bundled-component notices retained. Not a new scientific dataset or browser runtime.

Source match: CREDITS.md demo section; official upstream repository observed.

Link Text: x264 / VideoLAN

URL: https://www.videolan.org/developers/x264.html

Use: FFmpeg's recorded H.264 encoding component. The encoding-tool build and its notices are Claude's responsibility; no binary is shipped as application code.

Source match: CREDITS.md specifies libx264; public upstream URL was checked but returned an access error (418) to this reader, so live accessibility is not asserted.

Claude owns final video toolchain/notice validation; package versions not recorded in the public evidence are not invented. The web soundtrack itself is original Web Audio synthesis, not third-party sampled music: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/src/lib/ambientScore.mjs .

### Workflow/hosting tools

Link Text: GitHub Actions checkout

URL: https://github.com/actions/checkout

Use: Pinned CI tool, not a scientific or browser dependency; retain upstream action license.

Source match: .github/workflows/verify.yml and daily-data.yml.

Link Text: GitHub Actions setup-node

URL: https://github.com/actions/setup-node

Use: Pinned CI tool, not a scientific or browser dependency; retain upstream action license.

Source match: .github/workflows/verify.yml and daily-data.yml.

Link Text: GitHub Actions setup-python

URL: https://github.com/actions/setup-python

Use: Pinned CI tool, not a scientific or browser dependency; retain upstream action license.

Source match: .github/workflows/verify.yml and daily-data.yml.

Link Text: GitHub Actions cache

URL: https://github.com/actions/cache

Use: Pinned CI tool, not a scientific or browser dependency; retain upstream action license.

Source match: .github/workflows/verify.yml and daily-data.yml.

Link Text: GitHub Actions upload-artifact

URL: https://github.com/actions/upload-artifact

Use: Pinned CI tool, not a scientific or browser dependency; retain upstream action license.

Source match: .github/workflows/verify.yml and daily-data.yml.

Link Text: Cloudflare Pages public hosting

URL: https://lunacline.pages.dev/

Use: Static hosting service; not a dataset or incorporated code license.

Source match: README.md; VERIFICATION.md.

Link Text: GitHub source and automation

URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026

Use: Original source Apache-2.0, with third-party rights retained.

Source match: LICENSE; README.md.

### Method references and inspiration

Link Text: Mazarico et al. 2011, Illumination conditions of the lunar polar regions using LOLA topography, Icarus 211

URL: https://doi.org/10.1016/j.icarus.2010.10.030

Use: Method reference; authors/publisher retain rights.

Source match: manifest.provenance.references; scientific/README.md.

Link Text: Barker et al. 2021, Improved LOLA elevation maps for south pole landing sites, PSS 203

URL: https://doi.org/10.1016/j.pss.2020.105119

Use: Method reference; authors/publisher retain rights.

Source match: manifest.provenance.references; scientific/README.md.

Link Text: Research ledger WINNER-LESSONS.md

URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/WINNER-LESSONS.md

Use: Project-by-project source links and explicit observed/inaccessible/uncertain evidence. Ideas only, no code/assets/music reused. No judges' reasons or new award claims invented.

Source match: CREDITS.md; src/lib/content.js.

Link Text: Research ledger WINNER-GAP-20.md

URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/WINNER-GAP-20.md

Use: Project-by-project source links and explicit observed/inaccessible/uncertain evidence. Ideas only, no code/assets/music reused. No judges' reasons or new award claims invented.

Source match: CREDITS.md; src/lib/content.js.

Link Text: Research ledger WINNER-GAP-NEXT-20.md

URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/WINNER-GAP-NEXT-20.md

Use: Project-by-project source links and explicit observed/inaccessible/uncertain evidence. Ideas only, no code/assets/music reused. No judges' reasons or new award claims invented.

Source match: CREDITS.md; src/lib/content.js.

Link Text: Research ledger WINNER-ROUND-OCEAN-GARDENS.md

URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/WINNER-ROUND-OCEAN-GARDENS.md

Use: Project-by-project source links and explicit observed/inaccessible/uncertain evidence. Ideas only, no code/assets/music reused. No judges' reasons or new award claims invented.

Source match: CREDITS.md; src/lib/content.js.

Link Text: Research ledger WINNER-ROUND-SYMPHONY.md

URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/WINNER-ROUND-SYMPHONY.md

Use: Project-by-project source links and explicit observed/inaccessible/uncertain evidence. Ideas only, no code/assets/music reused. No judges' reasons or new award claims invented.

Source match: CREDITS.md; src/lib/content.js.

Link Text: Research ledger CLARITY-CORRECTIONS.md

URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/CLARITY-CORRECTIONS.md

Use: Project-by-project source links and explicit observed/inaccessible/uncertain evidence. Ideas only, no code/assets/music reused. No judges' reasons or new award claims invented.

Source match: CREDITS.md; src/lib/content.js.

Directly credited research references (labels as recorded, not new award findings):

- Link Text: Greetings from Earth!! / Ocean Gardens (2023)
  URL: https://github.com/OceanGardens/oceangardens.github.io
- Link Text: Ocean Gardens - interaction research and limitations
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/WINNER-ROUND-OCEAN-GARDENS.md
- Link Text: Spacebee — Moonquakes 2023
  URL: https://github.com/spacebee-technologies/Moonquakes-SpaceApps2023
- Link Text: 42 Quake Heroes interface
  URL: https://github.com/gabrielchayb/42-quake-heroes
- Link Text: Connected Earth Museum
  URL: https://github.com/connected-earth/connected-earth-museum
- Link Text: PureFlow 2025
  URL: https://github.com/larasdiniz/PureFlow-2025
- Link Text: 42 Quake Heroes notebook
  URL: https://github.com/gabrielchayb/42-model-source-notebook
- Link Text: Lunar Trek (LunarTech Ensemble, 2023)
  URL: https://github.com/yousefkotp/Lunar-Trek
- Link Text: Storm Prophet (2023)
  URL: https://github.com/Wizard2007/storm-prophet
- Link Text: Eco-Metropolis (2024)
  URL: https://github.com/RikzahK/Eco-Metropolis-Sustainable-City-Simulation---NASA-Space-App
- Link Text: TerraTales (2024)
  URL: https://github.com/habibaalaa123/TerraTales-NasaSpaceAppsChallenge
- Link Text: Gaia+LEO (2025)
  URL: https://github.com/stayingfoolish/gaia-LEO
- Link Text: Zumorroda-X / Henry's Farm Adventures (2025)
  URL: https://github.com/esralsayed/test_farmy
- Link Text: SkyShield, WMPGang (2024) — university report
  URL: https://news.westernu.ca/2025/01/western-students-win-nasa-challenge-with-app-shows-risks-to-space-infrastructure/
- Link Text: 2024 global winners — NASA announcement (Waterwise, 2plant, Landsat Connect, Asteroid Destroyer, G.R.O.W.)
  URL: https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/
- Link Text: 2025 global winners — official list (SpaceGenes+, Astro Sweepers, HerCode Space, Photonics Odyssey, QUEÑARIS, Resonant Exoplanets, Twisters)
  URL: https://www.spaceappschallenge.org/2025/awards/global-winners/
- Link Text: 2023 global winners — official list (Space Quest Maidens and others)
  URL: https://www.spaceappschallenge.org/2023/awards/global-winners/
- Link Text: Full mapping of 24 lessons to actions
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/WINNER-LESSONS.md
- Link Text: Twenty additional global winners, 2012–2015
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/WINNER-GAP-NEXT-20.md
- Link Text: Cambridge Asteroids / Voxsteroid (2021)
  URL: https://github.com/Laurence-Cullen/Asteroids
- Link Text: Change Maker / SHINE (2021)
  URL: https://github.com/ChangeMakerGroupEdition/Sunshine
- Link Text: Clarity corrections and additional winner research
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/docs/CLARITY-CORRECTIONS.md
- Link Text: CLPS Lunar Mission Browser
  URL: https://github.com/EmanuelAbasto/CLPS-Lunar-Mission-Browser
- Link Text: LuminaLuna
  URL: https://github.com/Planet-Coders/lunar-landing-site-navigator
- Link Text: Lunar Horizon
  URL: https://github.com/localizedprojects/CLPS-MOON-BROWSER

OpenHiggsfield was inspected but not used to generate production assets; do not misclassify it as reused software. Source/research ledgers explain this distinction.

## Evidence and consistency notes — not a form field

- Do not copy the README's stale introductory March–April 2027 / 1–5 m coverage sentence. The manifest and later rolling-coverage section supersede it.
- CREDITS.md's old 2k lunar texture is a retained historical asset; current rendering conversions are identified in globe/visual-assets.json. Keep the current 4k source distinct from that fallback.
- Do not turn older test counts or Lighthouse reports into current-candidate claims. This author has not rerun them.
- The guide's live SI text and the ideation history remain visible above. Do not replace that issue with a dropdown guess or a claim that disclosure guarantees eligibility.


## Complementary public provenance and license inventory

These are audit/notice links, not substitutes for specific NASA input citations. For provider/media projects whose use is named in CREDITS.md but whose repository URL is not printed there, the exact upstream was checked separately and that distinction is stated; no source use is inferred solely from finding a website. Metadata covers parent/output hashes, transformations and inherited rights.

- Link Text: Visible credits
  URL: https://lunacline.pages.dev/#/credits
- Link Text: Installed package inventory
  URL: https://lunacline.pages.dev/credits.json
- Link Text: AI/media disclosure
  URL: https://lunacline.pages.dev/ai-use.json
- Link Text: Active source manifest
  URL: https://lunacline.pages.dev/data/manifest.json
- Link Text: Executed scientific validation and limits
  URL: https://lunacline.pages.dev/data/validation.json
- Link Text: Core derived-data hashes
  URL: https://lunacline.pages.dev/data/integrity.json
- Link Text: Lunar/Earth color conversions
  URL: https://lunacline.pages.dev/data/globe/visual-assets.json
- Link Text: Global relief source
  URL: https://lunacline.pages.dev/data/globe/moon-elevation.json
- Link Text: Star-map source
  URL: https://lunacline.pages.dev/data/starmap/starmap.json
- Link Text: Cloud/specular rights
  URL: https://lunacline.pages.dev/data/globe/earth-layers.json
- Link Text: Mobile derivatives
  URL: https://lunacline.pages.dev/data/globe/mobile-textures.json
- Link Text: Planet/ring rights
  URL: https://lunacline.pages.dev/assets/planets/PROVENANCE.json
- Link Text: Near-field patches
  URL: https://lunacline.pages.dev/data/terrain/near.json
- Link Text: Visual terrain registration
  URL: https://lunacline.pages.dev/data/terrain/terrain.json
- Link Text: Original imagery/event logo
  URL: https://lunacline.pages.dev/assets/PROVENANCE.json
- Link Text: Embedded report fonts
  URL: https://lunacline.pages.dev/assets/fonts/report-fonts.json
- Link Text: LICENSE
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/LICENSE
- Link Text: CREDITS.md
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/CREDITS.md
- Link Text: THIRD_PARTY_NOTICES.md
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/THIRD_PARTY_NOTICES.md
- Link Text: scientific/requirements.txt
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/scientific/requirements.txt
- Link Text: scientific/source-lock.json
  URL: https://github.com/Andre1B/lunar-navigator-spaceapps-2026/blob/main/scientific/source-lock.json

Original code is Apache-2.0. Solar System Scope derivatives retain CC BY 4.0; fonts retain OFL; NASA/PDS/PGDA/NAIF materials retain source terms/attribution; protected event branding remains separate. No blanket relicensing or NASA endorsement is claimed.

### Installed JavaScript license snapshot

Source: public/credits.json, generated 2026-11-16T00:40:35.506Z. 188 installed runtime/build/verification packages. This is platform-specific, not a count of browser-bundled libraries. Deployment optional dependencies may differ.

- @babel/runtime 7.29.14 ? MIT; upstream https://github.com/babel/babel; notice https://lunacline.pages.dev/licenses/@babel__runtime.txt
- @cloudflare/kv-asset-handler 0.5.0 ? MIT OR Apache-2.0; upstream https://github.com/cloudflare/workers-sdk
- @cloudflare/unenv-preset 2.16.2 ? MIT OR Apache-2.0; upstream https://github.com/cloudflare/workers-sdk
- @cloudflare/workerd-windows-64 1.20261113.1 ? Apache-2.0; upstream https://github.com/cloudflare/workerd
- @cspotcode/source-map-support 0.8.1 ? MIT; upstream https://github.com/cspotcode/node-source-map-support; notice https://lunacline.pages.dev/licenses/@cspotcode__source-map-support.txt
- @esbuild/win32-x64 0.28.2 ? MIT; upstream https://github.com/evanw/esbuild
- @fontsource/fira-code 5.3.0 ? OFL-1.1; upstream https://github.com/fontsource/font-files; notice https://lunacline.pages.dev/licenses/@fontsource__fira-code.txt
- @fontsource/ibm-plex-mono 5.3.0 ? OFL-1.1; upstream https://github.com/fontsource/font-files; notice https://lunacline.pages.dev/licenses/@fontsource__ibm-plex-mono.txt
- @fontsource/instrument-serif 5.3.0 ? OFL-1.1; upstream https://github.com/fontsource/font-files; notice https://lunacline.pages.dev/licenses/@fontsource__instrument-serif.txt
- @fontsource/overpass 5.3.0 ? OFL-1.1; upstream https://github.com/fontsource/font-files; notice https://lunacline.pages.dev/licenses/@fontsource__overpass.txt
- @formatjs/ecma402-abstract 2.3.6 ? MIT; upstream https://github.com/formatjs/formatjs; notice https://lunacline.pages.dev/licenses/@formatjs__ecma402-abstract.txt
- @formatjs/fast-memoize 2.2.7 ? MIT; upstream https://github.com/formatjs/formatjs; notice https://lunacline.pages.dev/licenses/@formatjs__fast-memoize.txt
- @formatjs/icu-messageformat-parser 2.11.4 ? MIT; upstream https://github.com/formatjs/formatjs; notice https://lunacline.pages.dev/licenses/@formatjs__icu-messageformat-parser.txt
- @formatjs/icu-skeleton-parser 1.8.16 ? MIT; upstream https://github.com/formatjs/formatjs; notice https://lunacline.pages.dev/licenses/@formatjs__icu-skeleton-parser.txt
- @formatjs/intl-localematcher 0.6.2 ? MIT; upstream https://github.com/formatjs/formatjs; notice https://lunacline.pages.dev/licenses/@formatjs__intl-localematcher.txt
- @img/colour 1.1.0 ? MIT; upstream https://github.com/lovell/colour; notice https://lunacline.pages.dev/licenses/@img__colour.txt
- @img/sharp-wasm32 0.35.5 ? Apache-2.0 AND LGPL-3.0-or-later AND MIT; upstream https://github.com/lovell/sharp; notice https://lunacline.pages.dev/licenses/@img__sharp-wasm32.txt
- @img/sharp-win32-x64 0.35.5 ? Apache-2.0 AND LGPL-3.0-or-later; upstream https://github.com/lovell/sharp; notice https://lunacline.pages.dev/licenses/@img__sharp-win32-x64.txt
- @isaacs/nonrecursive-glob-match 1.1.0 ? BlueOak-1.0.0; upstream https://github.com/isaacs/nonrecursive-glob-match; notice https://lunacline.pages.dev/licenses/@isaacs__nonrecursive-glob-match.txt
- @jridgewell/resolve-uri 3.1.3 ? MIT; upstream https://github.com/jridgewell/resolve-uri; notice https://lunacline.pages.dev/licenses/@jridgewell__resolve-uri.txt
- @jridgewell/sourcemap-codec 1.6.0 ? MIT; upstream https://github.com/jridgewell/sourcemaps; notice https://lunacline.pages.dev/licenses/@jridgewell__sourcemap-codec.txt
- @jridgewell/trace-mapping 0.3.9 ? MIT; upstream https://github.com/jridgewell/trace-mapping; notice https://lunacline.pages.dev/licenses/@jridgewell__trace-mapping.txt
- @opentelemetry/api 1.10.0 ? Apache-2.0; upstream https://github.com/open-telemetry/opentelemetry-js; notice https://lunacline.pages.dev/licenses/@opentelemetry__api.txt
- @oxc-parser/binding-win32-x64-msvc 0.152.0 ? MIT; upstream https://github.com/oxc-project/oxc
- @oxc-project/types 0.156.0 ? MIT; upstream https://github.com/oxc-project/oxc; notice https://lunacline.pages.dev/licenses/@oxc-project__types.txt
- @paulirish/trace_engine 0.0.67 ? BSD-3-Clause; upstream https://github.com/ChromeDevTools/devtools-frontend; notice https://lunacline.pages.dev/licenses/@paulirish__trace_engine.txt
- @poppinss/colors 4.1.6 ? MIT; upstream https://github.com/poppinss/colors; notice https://lunacline.pages.dev/licenses/@poppinss__colors.txt
- @poppinss/dumper 0.6.5 ? MIT; upstream https://github.com/poppinss/dumper; notice https://lunacline.pages.dev/licenses/@poppinss__dumper.txt
- @poppinss/exception 1.2.3 ? MIT; upstream https://github.com/poppinss/exception; notice https://lunacline.pages.dev/licenses/@poppinss__exception.txt
- @puppeteer/browsers 3.2.7 ? Apache-2.0; upstream https://github.com/puppeteer/puppeteer/tree/main/packages/browsers
- @rolldown/binding-win32-x64-msvc 1.2.19 ? MIT; upstream https://github.com/rolldown/rolldown
- @rolldown/pluginutils 1.1.1 ? MIT; upstream https://github.com/rolldown/plugins; notice https://lunacline.pages.dev/licenses/@rolldown__pluginutils.txt
- @sentry/bundler-plugins 11.12.0 ? MIT; upstream https://github.com/getsentry/sentry-javascript; notice https://lunacline.pages.dev/licenses/@sentry__bundler-plugins.txt
- @sentry/conventions 0.32.0 ? MIT; upstream https://github.com/getsentry/sentry-conventions; notice https://lunacline.pages.dev/licenses/@sentry__conventions.txt
- @sentry/core 11.12.0 ? MIT; upstream https://github.com/getsentry/sentry-javascript; notice https://lunacline.pages.dev/licenses/@sentry__core.txt
- @sentry/node 11.12.0 ? MIT; upstream https://github.com/getsentry/sentry-javascript; notice https://lunacline.pages.dev/licenses/@sentry__node.txt
- @sentry/opentelemetry 11.12.0 ? MIT; upstream https://github.com/getsentry/sentry-javascript; notice https://lunacline.pages.dev/licenses/@sentry__opentelemetry.txt
- @sentry/server-runtime-injection 11.12.0 ? MIT; upstream https://github.com/getsentry/sentry-javascript; notice https://lunacline.pages.dev/licenses/@sentry__server-runtime-injection.txt
- @sentry/server-utils 11.12.0 ? MIT; upstream https://github.com/getsentry/sentry-javascript; notice https://lunacline.pages.dev/licenses/@sentry__server-utils.txt
- @sindresorhus/is 7.2.0 ? MIT; upstream https://github.com/sindresorhus/is; notice https://lunacline.pages.dev/licenses/@sindresorhus__is.txt
- @speed-highlight/core 1.2.24 ? CC0-1.0; upstream https://github.com/speed-highlight/core; notice https://lunacline.pages.dev/licenses/@speed-highlight__core.txt
- @types/node 26.6.6 ? MIT; upstream https://github.com/DefinitelyTyped/DefinitelyTyped; notice https://lunacline.pages.dev/licenses/@types__node.txt
- @types/pako 2.0.4 ? MIT; upstream https://github.com/DefinitelyTyped/DefinitelyTyped; notice https://lunacline.pages.dev/licenses/@types__pako.txt
- @types/raf 3.4.3 ? MIT; upstream https://github.com/DefinitelyTyped/DefinitelyTyped; notice https://lunacline.pages.dev/licenses/@types__raf.txt
- @types/trusted-types 2.0.7 ? MIT; upstream https://github.com/DefinitelyTyped/DefinitelyTyped; notice https://lunacline.pages.dev/licenses/@types__trusted-types.txt
- @vitejs/plugin-react 6.3.0 ? MIT; upstream https://github.com/vitejs/vite-plugin-react; notice https://lunacline.pages.dev/licenses/@vitejs__plugin-react.txt
- ajv 8.20.0 ? MIT; upstream https://github.com/ajv-validator/ajv; notice https://lunacline.pages.dev/licenses/ajv.txt
- ajv-formats 3.0.1 ? MIT; upstream https://github.com/ajv-validator/ajv-formats; notice https://lunacline.pages.dev/licenses/ajv-formats.txt
- ansi-colors 4.1.3 ? MIT; upstream https://github.com/doowb/ansi-colors; notice https://lunacline.pages.dev/licenses/ansi-colors.txt
- ansi-regex 5.0.1 ? MIT; upstream https://github.com/chalk/ansi-regex; notice https://lunacline.pages.dev/licenses/ansi-regex.txt
- ansi-styles 6.2.3 ? MIT; upstream https://github.com/chalk/ansi-styles; notice https://lunacline.pages.dev/licenses/ansi-styles.txt
- atomically 2.1.1 ? MIT; upstream https://github.com/fabiospampinato/atomically; notice https://lunacline.pages.dev/licenses/atomically.txt
- axe-core 4.14.0 ? MPL-2.0; upstream https://github.com/dequelabs/axe-core; notice https://lunacline.pages.dev/licenses/axe-core.txt
- balanced-match 4.0.4 ? MIT; upstream https://github.com/juliangruber/balanced-match; notice https://lunacline.pages.dev/licenses/balanced-match.txt
- base64-arraybuffer 1.0.2 ? MIT; upstream https://github.com/niklasvh/base64-arraybuffer; notice https://lunacline.pages.dev/licenses/base64-arraybuffer.txt
- blake3-wasm 2.1.5 ? MIT; upstream https://github.com/connor4312/blake3; notice https://lunacline.pages.dev/licenses/blake3-wasm.txt
- brace-expansion 5.0.13 ? MIT; upstream https://github.com/juliangruber/brace-expansion; notice https://lunacline.pages.dev/licenses/brace-expansion.txt
- bundle-name 4.1.1 ? MIT; upstream https://github.com/sindresorhus/bundle-name; notice https://lunacline.pages.dev/licenses/bundle-name.txt
- canvg 3.0.11 ? MIT; upstream https://github.com/canvg/canvg; notice https://lunacline.pages.dev/licenses/canvg.txt
- chrome-launcher 1.2.3 ? Apache-2.0; upstream https://github.com/GoogleChrome/chrome-launcher; notice https://lunacline.pages.dev/licenses/chrome-launcher.txt
- chromium-bidi 157.0.8090-0 ? Apache-2.0; upstream https://github.com/GoogleChromeLabs/chromium-bidi; notice https://lunacline.pages.dev/licenses/chromium-bidi.txt
- cliui 9.0.1 ? ISC; upstream https://github.com/yargs/cliui; notice https://lunacline.pages.dev/licenses/cliui.txt
- configstore 8.0.0 ? BSD-2-Clause; upstream https://github.com/sindresorhus/configstore; notice https://lunacline.pages.dev/licenses/configstore.txt
- cookie 1.1.1 ? MIT; upstream https://github.com/jshttp/cookie; notice https://lunacline.pages.dev/licenses/cookie.txt
- core-js 3.51.0 ? MIT; upstream https://github.com/zloirock/core-js; notice https://lunacline.pages.dev/licenses/core-js.txt
- csp_evaluator 1.1.8 ? Apache-2.0; upstream https://github.com/google/csp-evaluator; notice https://lunacline.pages.dev/licenses/csp_evaluator.txt
- css-line-break 2.1.0 ? MIT; upstream https://github.com/niklasvh/css-line-break; notice https://lunacline.pages.dev/licenses/css-line-break.txt
- debug 4.4.3 ? MIT; upstream https://github.com/debug-js/debug; notice https://lunacline.pages.dev/licenses/debug.txt
- decimal.js 10.6.0 ? MIT; upstream https://github.com/MikeMcl/decimal.js; notice https://lunacline.pages.dev/licenses/decimal.js.txt
- default-browser 5.5.1 ? MIT; upstream https://github.com/sindresorhus/default-browser; notice https://lunacline.pages.dev/licenses/default-browser.txt
- default-browser-id 5.0.1 ? MIT; upstream https://github.com/sindresorhus/default-browser-id; notice https://lunacline.pages.dev/licenses/default-browser-id.txt
- define-lazy-prop 3.0.0 ? MIT; upstream https://github.com/sindresorhus/define-lazy-prop; notice https://lunacline.pages.dev/licenses/define-lazy-prop.txt
- detect-libc 2.1.2 ? Apache-2.0; upstream https://github.com/lovell/detect-libc; notice https://lunacline.pages.dev/licenses/detect-libc.txt
- devtools-protocol 0.0.1727723 ? BSD-3-Clause; upstream https://github.com/ChromeDevTools/devtools-protocol; notice https://lunacline.pages.dev/licenses/devtools-protocol.txt
- dompurify 3.4.18 ? (MPL-2.0 OR Apache-2.0); upstream https://github.com/cure53/DOMPurify; notice https://lunacline.pages.dev/licenses/dompurify.txt
- dot-prop 10.2.0 ? MIT; upstream https://github.com/sindresorhus/dot-prop; notice https://lunacline.pages.dev/licenses/dot-prop.txt
- dotenv 17.4.2 ? BSD-2-Clause; upstream https://github.com/motdotla/dotenv; notice https://lunacline.pages.dev/licenses/dotenv.txt
- emoji-regex 10.6.0 ? MIT; upstream https://github.com/mathiasbynens/emoji-regex
- enquirer 2.4.1 ? MIT; upstream https://github.com/enquirer/enquirer; notice https://lunacline.pages.dev/licenses/enquirer.txt
- error-stack-parser-es 1.0.5 ? MIT; upstream https://github.com/antfu/error-stack-parser-es; notice https://lunacline.pages.dev/licenses/error-stack-parser-es.txt
- esbuild 0.28.2 ? MIT; upstream https://github.com/evanw/esbuild; notice https://lunacline.pages.dev/licenses/esbuild.txt
- escalade 3.2.0 ? MIT; upstream https://github.com/lukeed/escalade; notice https://lunacline.pages.dev/licenses/escalade.txt
- escape-string-regexp 4.0.0 ? MIT; upstream https://github.com/sindresorhus/escape-string-regexp; notice https://lunacline.pages.dev/licenses/escape-string-regexp.txt
- fast-deep-equal 3.1.3 ? MIT; upstream https://github.com/epoberezkin/fast-deep-equal; notice https://lunacline.pages.dev/licenses/fast-deep-equal.txt
- fast-png 6.4.0 ? MIT; upstream https://github.com/image-js/fast-png; notice https://lunacline.pages.dev/licenses/fast-png.txt
- fast-uri 3.1.9 ? BSD-3-Clause; upstream https://github.com/fastify/fast-uri; notice https://lunacline.pages.dev/licenses/fast-uri.txt
- fdir 6.5.0 ? MIT; upstream https://github.com/thecodrr/fdir; notice https://lunacline.pages.dev/licenses/fdir.txt
- fflate 0.8.3 ? MIT; upstream https://github.com/101arrowz/fflate; notice https://lunacline.pages.dev/licenses/fflate.txt
- get-caller-file 2.0.5 ? ISC; upstream https://github.com/stefanpenner/get-caller-file; notice https://lunacline.pages.dev/licenses/get-caller-file.txt
- get-east-asian-width 1.7.0 ? MIT; upstream https://github.com/sindresorhus/get-east-asian-width; notice https://lunacline.pages.dev/licenses/get-east-asian-width.txt
- glob 14.0.6 ? BlueOak-1.0.0; upstream https://github.com/isaacs/node-glob; notice https://lunacline.pages.dev/licenses/glob.txt
- graceful-fs 4.2.12 ? BlueOak-1.0.0; upstream https://github.com/isaacs/node-graceful-fs; notice https://lunacline.pages.dev/licenses/graceful-fs.txt
- html2canvas 1.4.1 ? MIT; upstream https://github.com/niklasvh/html2canvas; notice https://lunacline.pages.dev/licenses/html2canvas.txt
- http-link-header 1.1.4 ? MIT; upstream https://codeberg.org/jhermsmeier/node-http-link-header; notice https://lunacline.pages.dev/licenses/http-link-header.txt
- image-ssim 0.2.0 ? MIT; upstream https://github.com/darosh/image-ssim-js; notice https://lunacline.pages.dev/licenses/image-ssim.txt
- intl-messageformat 10.7.18 ? BSD-3-Clause; upstream https://github.com/formatjs/formatjs; notice https://lunacline.pages.dev/licenses/intl-messageformat.txt
- iobuffer 5.4.0 ? MIT; upstream https://github.com/image-js/iobuffer; notice https://lunacline.pages.dev/licenses/iobuffer.txt
- is-docker 2.2.1 ? MIT; upstream https://github.com/sindresorhus/is-docker; notice https://lunacline.pages.dev/licenses/is-docker.txt
- is-in-ssh 1.0.0 ? MIT; upstream https://github.com/sindresorhus/is-in-ssh; notice https://lunacline.pages.dev/licenses/is-in-ssh.txt
- is-inside-container 1.0.0 ? MIT; upstream https://github.com/sindresorhus/is-inside-container; notice https://lunacline.pages.dev/licenses/is-inside-container.txt
- is-safe-filename 0.1.1 ? MIT; upstream https://github.com/sindresorhus/is-safe-filename; notice https://lunacline.pages.dev/licenses/is-safe-filename.txt
- is-wsl 2.2.0 ? MIT; upstream https://github.com/sindresorhus/is-wsl; notice https://lunacline.pages.dev/licenses/is-wsl.txt
- jpeg-js 0.4.4 ? BSD-3-Clause; upstream https://github.com/eugeneware/jpeg-js; notice https://lunacline.pages.dev/licenses/jpeg-js.txt
- js-library-detector 6.7.0 ? MIT; upstream https://github.com/johnmichel/Library-Detector-for-Chrome; notice https://lunacline.pages.dev/licenses/js-library-detector.txt
- json-schema-traverse 1.0.0 ? MIT; upstream https://github.com/epoberezkin/json-schema-traverse; notice https://lunacline.pages.dev/licenses/json-schema-traverse.txt
- jspdf 4.2.1 ? MIT; upstream https://github.com/parallax/jsPDF; notice https://lunacline.pages.dev/licenses/jspdf.txt
- kleur 4.1.5 ? MIT; upstream https://github.com/lukeed/kleur; notice https://lunacline.pages.dev/licenses/kleur.txt
- lighthouse 13.6.0 ? Apache-2.0; upstream https://github.com/GoogleChrome/lighthouse; notice https://lunacline.pages.dev/licenses/lighthouse.txt
- lighthouse-logger 2.0.2 ? Apache-2.0; upstream https://github.com/GoogleChrome/lighthouse; notice https://lunacline.pages.dev/licenses/lighthouse-logger.txt
- lighthouse-stack-packs 1.12.3 ? Apache-2.0; upstream https://github.com/GoogleChrome/lighthouse-stack-packs; notice https://lunacline.pages.dev/licenses/lighthouse-stack-packs.txt
- lightningcss 1.33.0 ? MPL-2.0; upstream https://github.com/parcel-bundler/lightningcss; notice https://lunacline.pages.dev/licenses/lightningcss.txt
- lightningcss-win32-x64-msvc 1.33.0 ? MPL-2.0; upstream https://github.com/parcel-bundler/lightningcss; notice https://lunacline.pages.dev/licenses/lightningcss-win32-x64-msvc.txt
- lru-cache 11.5.3 ? BlueOak-1.0.0; upstream https://github.com/isaacs/node-lru-cache; notice https://lunacline.pages.dev/licenses/lru-cache.txt
- magic-string 1.4.5 ? MIT; upstream https://github.com/Rich-Harris/magic-string; notice https://lunacline.pages.dev/licenses/magic-string.txt
- marky 1.3.0 ? Apache-2.0; upstream https://github.com/nolanlawson/marky; notice https://lunacline.pages.dev/licenses/marky.txt
- miniflare 5.20261113.0-beta ? MIT; upstream https://github.com/cloudflare/workers-sdk
- minimatch 11.0.8 ? BlueOak-1.0.0; upstream https://github.com/isaacs/minimatch; notice https://lunacline.pages.dev/licenses/minimatch.txt
- minipass 7.1.3 ? BlueOak-1.0.0; upstream https://github.com/isaacs/minipass; notice https://lunacline.pages.dev/licenses/minipass.txt
- mitt 3.0.1 ? MIT; upstream https://github.com/developit/mitt; notice https://lunacline.pages.dev/licenses/mitt.txt
- modern-tar 0.8.6 ? MIT; upstream https://github.com/ayuhito/modern-tar; notice https://lunacline.pages.dev/licenses/modern-tar.txt
- ms 2.1.3 ? MIT; upstream https://github.com/vercel/ms; notice https://lunacline.pages.dev/licenses/ms.txt
- nanoid 3.3.20 ? MIT; upstream https://github.com/ai/nanoid; notice https://lunacline.pages.dev/licenses/nanoid.txt
- open 11.0.4 ? MIT; upstream https://github.com/sindresorhus/open; notice https://lunacline.pages.dev/licenses/open.txt
- oxc-parser 0.152.0 ? MIT; upstream https://github.com/oxc-project/oxc; notice https://lunacline.pages.dev/licenses/oxc-parser.txt
- pako 2.2.0 ? (MIT AND Zlib); upstream https://github.com/nodeca/pako; notice https://lunacline.pages.dev/licenses/pako.txt
- path-scurry 3.0.0 ? BlueOak-1.0.0; upstream https://github.com/isaacs/path-scurry; notice https://lunacline.pages.dev/licenses/path-scurry.txt
- path-to-regexp 6.3.0 ? MIT; upstream https://github.com/pillarjs/path-to-regexp; notice https://lunacline.pages.dev/licenses/path-to-regexp.txt
- pathe 2.0.3 ? MIT; upstream https://github.com/unjs/pathe; notice https://lunacline.pages.dev/licenses/pathe.txt
- performance-now 2.1.0 ? MIT; upstream https://github.com/braveg1rl/performance-now; notice https://lunacline.pages.dev/licenses/performance-now.txt
- picocolors 1.1.1 ? ISC; upstream https://github.com/alexeyraspopov/picocolors; notice https://lunacline.pages.dev/licenses/picocolors.txt
- picomatch 4.0.7 ? MIT; upstream https://github.com/micromatch/picomatch; notice https://lunacline.pages.dev/licenses/picomatch.txt
- playwright 1.65.1 ? Apache-2.0; upstream https://github.com/microsoft/playwright; notice https://lunacline.pages.dev/licenses/playwright.txt
- playwright-core 1.65.1 ? Apache-2.0; upstream https://github.com/microsoft/playwright; notice https://lunacline.pages.dev/licenses/playwright-core.txt
- postcss 8.5.33 ? MIT; upstream https://github.com/postcss/postcss; notice https://lunacline.pages.dev/licenses/postcss.txt
- powershell-utils 0.2.1 ? MIT; upstream https://github.com/sindresorhus/powershell-utils; notice https://lunacline.pages.dev/licenses/powershell-utils.txt
- prettier 3.10.1 ? MIT; upstream https://github.com/prettier/prettier; notice https://lunacline.pages.dev/licenses/prettier.txt
- puppeteer-core 25.17.0 ? Apache-2.0; upstream https://github.com/puppeteer/puppeteer/tree/main/packages/puppeteer-core
- raf 3.4.1 ? MIT; upstream https://github.com/chrisdickinson/raf; notice https://lunacline.pages.dev/licenses/raf.txt
- react 19.3.1 ? MIT; upstream https://github.com/react/react; notice https://lunacline.pages.dev/licenses/react.txt
- react-dom 19.3.1 ? MIT; upstream https://github.com/react/react; notice https://lunacline.pages.dev/licenses/react-dom.txt
- regenerator-runtime 0.13.11 ? MIT; upstream https://github.com/facebook/regenerator/tree/main/packages/runtime; notice https://lunacline.pages.dev/licenses/regenerator-runtime.txt
- require-from-string 2.0.2 ? MIT; upstream https://github.com/floatdrop/require-from-string; notice https://lunacline.pages.dev/licenses/require-from-string.txt
- rgbcolor 1.0.1 ? MIT OR SEE LICENSE IN FEEL-FREE.md; upstream https://github.com/yetzt/node-rgbcolor; notice https://lunacline.pages.dev/licenses/rgbcolor.txt
- robots-parser 3.0.1 ? MIT; upstream https://github.com/samclarke/robots-parser; notice https://lunacline.pages.dev/licenses/robots-parser.txt
- rolldown 1.2.19 ? MIT; upstream https://github.com/rolldown/rolldown; notice https://lunacline.pages.dev/licenses/rolldown.txt
- run-applescript 7.1.0 ? MIT; upstream https://github.com/sindresorhus/run-applescript; notice https://lunacline.pages.dev/licenses/run-applescript.txt
- scheduler 0.28.0 ? MIT; upstream https://github.com/react/react; notice https://lunacline.pages.dev/licenses/scheduler.txt
- semver 7.8.6 ? ISC; upstream https://github.com/npm/node-semver; notice https://lunacline.pages.dev/licenses/semver.txt
- sentry 0.49.0 ? FSL-1.1-Apache-2.0; upstream https://github.com/getsentry/toolkit; notice https://lunacline.pages.dev/licenses/sentry.txt
- sharp 0.35.5 ? Apache-2.0; upstream https://github.com/lovell/sharp; notice https://lunacline.pages.dev/licenses/sharp.txt
- source-map-js 1.2.2 ? BSD-3-Clause; upstream https://github.com/7rulnik/source-map-js; notice https://lunacline.pages.dev/licenses/source-map-js.txt
- speedline-core 1.4.3 ? MIT; upstream https://github.com/paulirish/speedline
- stackblur-canvas 2.7.0 ? MIT; upstream https://github.com/flozz/StackBlur
- string-width 8.3.0 ? MIT; upstream https://github.com/sindresorhus/string-width; notice https://lunacline.pages.dev/licenses/string-width.txt
- strip-ansi 6.0.1 ? MIT; upstream https://github.com/chalk/strip-ansi; notice https://lunacline.pages.dev/licenses/strip-ansi.txt
- stubborn-fs 2.0.0 ? MIT; upstream https://github.com/fabiospampinato/stubborn-fs; notice https://lunacline.pages.dev/licenses/stubborn-fs.txt
- stubborn-utils 1.0.2 ? MIT; upstream https://github.com/fabiospampinato/stubborn-utils; notice https://lunacline.pages.dev/licenses/stubborn-utils.txt
- supports-color 10.2.2 ? MIT; upstream https://github.com/chalk/supports-color; notice https://lunacline.pages.dev/licenses/supports-color.txt
- svg-pathdata 6.0.3 ? MIT; upstream https://github.com/nfroidure/svg-pathdata; notice https://lunacline.pages.dev/licenses/svg-pathdata.txt
- tagged-tag 1.0.0 ? MIT; upstream https://github.com/sindresorhus/tagged-tag; notice https://lunacline.pages.dev/licenses/tagged-tag.txt
- text-segmentation 1.0.3 ? MIT; upstream https://github.com/niklasvh/text-segmentation; notice https://lunacline.pages.dev/licenses/text-segmentation.txt
- third-party-web 0.30.0 ? MIT; upstream https://github.com/patrickhulce/third-party-web; notice https://lunacline.pages.dev/licenses/third-party-web.txt
- three 0.187.0 ? MIT; upstream https://github.com/mrdoob/three.js; notice https://lunacline.pages.dev/licenses/three.txt
- tinyglobby 0.2.17 ? MIT; upstream https://github.com/SuperchupuDev/tinyglobby; notice https://lunacline.pages.dev/licenses/tinyglobby.txt
- tldts-core 7.5.2 ? MIT; upstream https://github.com/remusao/tldts; notice https://lunacline.pages.dev/licenses/tldts-core.txt
- tldts-icann 7.5.2 ? MIT; upstream https://github.com/remusao/tldts; notice https://lunacline.pages.dev/licenses/tldts-icann.txt
- tslib 2.9.1 ? 0BSD; upstream https://github.com/Microsoft/tslib; notice https://lunacline.pages.dev/licenses/tslib.txt
- type-fest 5.10.0 ? (MIT OR CC0-1.0); upstream https://github.com/sindresorhus/type-fest
- typed-query-selector 2.12.3 ? MIT; upstream https://github.com/g-plane/typed-query-selector; notice https://lunacline.pages.dev/licenses/typed-query-selector.txt
- undici 7.30.1 ? MIT; upstream https://github.com/nodejs/undici; notice https://lunacline.pages.dev/licenses/undici.txt
- undici-types 8.9.0 ? MIT; upstream https://github.com/nodejs/undici; notice https://lunacline.pages.dev/licenses/undici-types.txt
- unenv 2.0.0-rc.24 ? MIT; upstream https://github.com/unjs/unenv; notice https://lunacline.pages.dev/licenses/unenv.txt
- utrie 1.0.2 ? MIT; upstream https://github.com/niklasvh/utrie; notice https://lunacline.pages.dev/licenses/utrie.txt
- vite 8.3.8 ? MIT; upstream https://github.com/vitejs/vite; notice https://lunacline.pages.dev/licenses/vite.txt
- webdriver-bidi-protocol 1.0.2 ? Apache-2.0; upstream https://github.com/GoogleChromeLabs/webdriver-bidi-protocol; notice https://lunacline.pages.dev/licenses/webdriver-bidi-protocol.txt
- when-exit 2.1.5 ? MIT; upstream https://github.com/fabiospampinato/when-exit; notice https://lunacline.pages.dev/licenses/when-exit.txt
- workerd 1.20261113.1 ? Apache-2.0; upstream https://github.com/cloudflare/workerd
- wrangler 4.162.0 ? MIT OR Apache-2.0; upstream https://github.com/cloudflare/workers-sdk
- wrap-ansi 9.0.2 ? MIT; upstream https://github.com/chalk/wrap-ansi; notice https://lunacline.pages.dev/licenses/wrap-ansi.txt
- ws 8.23.0 ? MIT; upstream https://github.com/websockets/ws; notice https://lunacline.pages.dev/licenses/ws.txt
- wsl-utils 1.0.1 ? MIT; upstream https://github.com/sindresorhus/wsl-utils; notice https://lunacline.pages.dev/licenses/wsl-utils.txt
- xdg-basedir 5.1.0 ? MIT; upstream https://github.com/sindresorhus/xdg-basedir; notice https://lunacline.pages.dev/licenses/xdg-basedir.txt
- y18n 5.0.8 ? ISC; upstream https://github.com/yargs/y18n; notice https://lunacline.pages.dev/licenses/y18n.txt
- yargs 18.2.0 ? MIT; upstream https://github.com/yargs/yargs; notice https://lunacline.pages.dev/licenses/yargs.txt
- yargs-parser 22.0.0 ? ISC; upstream https://github.com/yargs/yargs-parser; notice https://lunacline.pages.dev/licenses/yargs-parser.txt
- youch 4.1.0-beta.10 ? MIT; upstream https://github.com/poppinss/youch; notice https://lunacline.pages.dev/licenses/youch.txt
- youch-core 0.3.3 ? MIT; upstream https://github.com/poppinss/youch-core; notice https://lunacline.pages.dev/licenses/youch-core.txt
- zod 4.6.7 ? MIT; upstream https://github.com/colinhacks/zod; notice https://lunacline.pages.dev/licenses/zod.txt

### Public observation for this handoff

Unauthenticated HTTP at approximately 2026-11-16 01:27 UTC returned 200 for root, manifest and AI metadata. HTML referenced /assets/index-CRNre97J.js and no /src/main.jsx. Live manifest generatedAtUtc was 2026-11-16T00:35:50Z, coverage 2025-11-16 through 2027-11-16 UTC, heights 0.5/1/2/5/10 m. Live AI metadata still credited am_michael. Root/Claude separately confirmed published app source 9e73651; this author did not infer that SHA from an asset filename. Follow-up 9790e01 was propagating when reported. HTTP reachability is not functional/GPU/video-duration/Lighthouse validation.
