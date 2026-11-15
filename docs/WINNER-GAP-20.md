# Twenty additional global winners: useful gaps for Lunar Navigator

Research date: 2026-11-14. This study adds **20 distinct category winners from 2016–2019**, beyond the projects already covered in [WINNER-LESSONS.md](WINNER-LESSONS.md), [CLARITY-CORRECTIONS.md](CLARITY-CORRECTIONS.md) and the earlier private 2020–2025 inventory. It excludes finalists and People's Choice entries.

Award status was checked on the official lists for [2019](https://2019.spaceappschallenge.org/awards/), [2018](https://2018.spaceappschallenge.org/awards/global-finalists/), [2017](https://2017.spaceappschallenge.org/awards/global-finalists) and [2016](https://2016.spaceappschallenge.org/awards). The 2018 individual pages retain a generic nominee label; the final standings explicitly identify the six winners. The [2026 challenge](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=details) was reread: rapid, understandable comparison of sites and dates remains the objective.

**Evidence rule:** a submission establishes what a team presented, not that every claim works. Repository observations below are limited to the files read at their current state, not a verified competition submission commit. No competitor code was installed, executed or copied. Lessons and priorities are our interpretations; individual judges' reasons were not available.

## Changes worth considering

- **Highest remaining gap: actual beginner comprehension.** Radaway, Kid on the Moon and WanderSpace describe research with their intended users. Lunar has expert review and automated QA, but those do not measure whether a newcomer understands the result. Observe a short uncoached task before claiming that the clarity problem is solved: explain the app's question; distinguish an instantaneous visible-disc percentage from a percentage of the stay; identify the date used by the alternative point; explain observer height; inspect and return to the original comparison.
- **Keep the explanation beside the representation.** Make the chain visible: date and height change the body's position relative to the terrain horizon; that changes visible-disc fractions and visibility intervals. Identify terrain brightness as illustrative and keep validated horizon occlusion authoritative. This reinforces the existing clarity work rather than adding another mode.
- **Protect the useful path when 3D is unavailable.** Compare, its explanations and the downloadable result should still answer the landing-delay question without WebGL. This is a verification target, not a result measured by this research.
- **Optional small experiment aid:** offer inspection just before/after an already calculated rise or set, with clear interpolation/resolution labels. The current event component displays times but has no jump action. Defer this if it complicates the playback fixes; no new physical model is needed.

Most lessons below are already covered. Twenty additional winners do **not** justify twenty new features.

## The twenty projects

### 1. AEDES Project — 2019, Best Use of Data

**Observed:** the [submission](https://2019.spaceappschallenge.org/challenges/living-our-world/smash-your-sdgs/teams/aedes-project/) explains a causal chain, names public-health users and justifies four pilot areas by data availability. Its linked repository now redirects to [docligot/aedesproject](https://github.com/docligot/aedesproject); the README and model-directory inventory were read.

**Lunar comparison:** explaining why these four study points are supported is more useful than implying arbitrary worldwide coverage. Keep the input → geometry → consequence explanation. Curated coverage and provenance already exist; claimed dengue forecast accuracy was not validated or adopted.

### 2. Cafeína / Ocean Ride — 2019, Best Use of Hardware

**Observed:** the [submission](https://2019.spaceappschallenge.org/challenges/earths-oceans/trash-cleanup/teams/cafeina/) presents a proposed microplastic collector, drawings and collection/storage/removal workflow, fitted to existing vessels or fixed platforms. No project repository was observed.

**Lunar comparison:** build around the user's existing task and resources. The original/delayed/alternative comparison does that. No new hardware or feature follows from this analogy; the award does not establish the proposed collector's physical performance.

### 3. c.a.w.s.t.o.n. / phoeNEX — 2019, Best Mission Concept

**Observed:** the [submission](https://2019.spaceappschallenge.org/challenges/living-our-world/spot-fire-v20/teams/cawston/) separates authority-confirmed information from community reports and labels slides as mockups. The linked [repository](https://github.com/rcslaney/NASA-Space-Apps-Spot-The-Fire-v2.0), including `main.py`, contains Flask routes, FIRMS data access and report uploads.

**Lunar comparison:** keep computed quantities, illustrative rendering and unsupported operational conclusions distinct. The horizon/terrain labels address this. Do not import evacuation, AR or prediction claims; those were not independently checked.

### 4. Massa / Poseidon — 2019, Galactic Impact

**Observed:** the [submission](https://2019.spaceappschallenge.org/challenges/living-our-world/smash-your-sdgs/teams/massa/) discusses oil-spill image confusion, training-data shortages and future work. No project repository was observed; its scientific and accuracy claims were not tested.

**Lunar comparison:** show how an appearance can mislead: dark rendered ground does not itself establish an occulted Sun, and visible Earth does not establish a radio link. Existing corrections cover this; no image classifier is warranted.

### 5. StarStruck / Plan-It — 2019, Most Inspirational

**Observed:** the [submission](https://2019.spaceappschallenge.org/challenges/planets-near-and-far/build-planet-workshop/teams/starstruck/) describes starting at the star, changing properties through a nearby menu and opening contextual explanations. It links a Unity game, but its runtime was not tested and no source repository was observed.

**Lunar comparison:** aim at the relevant object and explain the change next to the controls. Sun/Earth aiming and nearby result explanations already address this; solar-system building is outside the landing-delay task.

### 6. The Great Bloom Theory — 2019, Best Use of Science

**Observed:** the [submission](https://2019.spaceappschallenge.org/challenges/living-our-world/bloom-or-not-bloom/teams/the-great-bloom-theory/) discusses combining image learning with interpretable decision trees and names satellite inputs. Its [linked repository](https://github.com/Danieluss/NASASpaceAppsBloom) returned 404; the advertised prediction accuracy was not verified.

**Lunar comparison:** retain an understandable explanation alongside inspectable calculations. Lunar already has a deterministic method and validation record. An opaque score or AI replacement would weaken that advantage.

### 7. Olik / Lunar VR — 2018, Best Use of Data

**Observed:** the [submission](https://2018.spaceappschallenge.org/challenges/universe-beauty-and-wonder/virtual-space-exploration/teams/olik/) separates Apollo surface exploration, LRO orbit and an eclipse experience. The linked [repository](https://github.com/asmahdi/lunarvr) README and asset inventory were read; the README states mobile-only support. Simulation accuracy was not checked.

**Lunar comparison:** narrate each change of viewpoint: orbital globe, overhead terrain and selected observer's sky answer different questions. Existing camera explanations should carry that distinction. A VR dependency adds no necessary capability.

### 8. DeltaProtocol / DeltaMesh — 2018, Best Use of Hardware

**Observed:** the [submission](https://2018.spaceappschallenge.org/challenges/can-you-build/make-sense-out-mars/teams/deltaprotocol/) describes remote/mobile stations, coverage and connection-loss behavior. The linked [repository](https://github.com/juantinazzo/SpaceApps2018) root and README contain documentation and presentation material; no operational network was tested.

**Lunar comparison:** distinguish a geometric opportunity from a functioning communications system, and unknown data from a calculated zero. Existing caveats cover the first. Medical, energy and rescue claims were not adopted.

### 9. that-vr-team / WanderSpace — 2018, Best Mission Concept

**Observed:** the [submission](https://2018.spaceappschallenge.org/challenges/universe-beauty-and-wonder/virtual-space-exploration/teams/that-vr-team/) distinguishes its current one-game experiment from its roadmap: throw a stick on different planets to explore changing conditions. It proposes specific school-user questions. No source repository or executed runtime was inspected.

**Lunar comparison:** use one controlled change and observe whether users understand its consequence. The five-height and arrival-delay experiments provide the mechanism; measured beginner comprehension remains missing. Multiplayer and voice assistants are unnecessary.

### 10. iNON / ISDApp — 2018, Galactic Impact

**Observed:** the [submission](https://2018.spaceappschallenge.org/challenges/what-world-needs-now/globe-observer/teams/inon-1/) explicitly targets fishermen without smartphones or internet, using ordinary phones. Architecture, write-up and assets are linked through Drive; those files and the runtime were not inspected.

**Lunar comparison:** the medium should not prevent the intended audience from getting the answer. Preserve a useful text/table comparison when 3D cannot run. This does not justify SMS or a new platform.

### 11. Salinity / SongSAT — 2018, Most Inspirational

**Observed:** the [submission](https://2018.spaceappschallenge.org/challenges/help-others-discover-earth/artify-earth/teams/salinity-1/) and linked [repository](https://github.com/mcvittal/SongSAT) README/`main.py` expose raster-to-MIDI mappings, authored scales and random rhythms. The README separates the generator from the website and documents substantial source-data dependencies.

**Lunar comparison:** make alternative encodings understandable, and preserve a nonvisual description of the result. `SkyDescription` already supplies words. Music would be a designed encoding, not another physical measurement; no sonification or autoplay is needed.

### 12. Pillars of Creation / Galaxy Quest — 2018, Best Use of Science

**Observed:** the [submission](https://2018.spaceappschallenge.org/challenges/universe-beauty-and-wonder/shoulders-giants/teams/pillars-of-creation/) describes short missions and a contribution outcome. The [main repository](https://github.com/PillarsOfCreationTeam/GalaxyQuest) contains mockups/slides; the separate [scoring README](https://github.com/PillarsOfCreationTeam/scoring) describes crowd masks and a participant test. Neither is proof of classification accuracy.

**Lunar comparison:** give an exploration a finish: change one input, see the consequence, inspect why, return with the comparison intact. The current workflow covers much of this. Rankings and crowdsourced science are outside scope.

### 13. Lemon Py / Pollen Alert — 2017, Best Use of Data

**Observed:** the [submission](https://2017.spaceappschallenge.org/challenges/our-ecological-neighborhood/trace-invaders/teams/lemon-py-1) distinguishes research questions, data, actual progress and future routing/dispersion. Its linked [organization](https://github.com/Lemon-Py/) publishes separate tree-map and analysis repositories; their algorithms were not validated here.

**Lunar comparison:** separate delivered coverage from future capability. Four computed points and a bounded period should not read as arbitrary-coordinate or operational planning support. This is chiefly a wording/coverage discipline already present.

### 14. HALA — 2017, Best Use of Hardware

**Observed:** the [submission](https://2017.spaceappschallenge.org/challenges/ideate-and-create/1d-2d-3d-go/teams/hala-1) links [source](https://github.com/smff/sp7). The README and `api/index.js` show separate temperature/pressure layers and explicit rotation/stop controls. Hardware and rendering were not executed.

**Lunar comparison:** make each layer and motion controllable and identifiable. Camera controls, pause and Faithful/Free labels already serve this. A holographic display would add spectacle without improving the comparison.

### 15. Space Bar / Landslide Victory — 2017, Best Mission Concept

**Observed:** the [submission](https://2017.spaceappschallenge.org/challenges/warning-danger-ahead/when-landslides-strike/teams/space-bar) separates historical, precipitation, model and witness layers. The linked [repository](https://github.com/kai-feng-chen/LandSlide_BengBengBeng) README and `hello.py` confirm distinct data paths. Its prediction-market and operational claims were not validated.

**Lunar comparison:** keep source, time and representation visible when switching views. The shared clock and viewpoint explanations address this. Citizen reports, betting and emergency alerts are not relevant additions.

### 16. Radaway — 2017, Galactic Impact

**Observed:** the [submission](https://2017.spaceappschallenge.org/challenges/warning-danger-ahead/mayday-mayday-mayday/teams/radaway) explicitly describes moving away from a technically focused visualization, interviewing intended users and framing numbers in context. It links workflow images and a process article; no implementation or medical-risk calculation was verified.

**Lunar comparison:** a correct number can still fail to answer a person's question. Result explanations are now stronger, but direct observation of newcomers completing a task remains a material gap. Do not borrow health-risk analogies or infer why judges selected the project.

### 17. Grovr — 2017, Most Inspirational

**Observed:** the [submission](https://2017.spaceappschallenge.org/challenges/earth-and-us/live-smart/teams/grovr) presents a short named action loop. The linked [repository](https://github.com/abniyaz/grovr) routes and selected view were read; they do not establish that all described farming/reward features function. Environmental benefits were not checked.

**Lunar comparison:** use visible stages and a finite outcome. The comparison flow and tour already provide these. Avoid points, competitive ranking and colors that imply operational safety.

### 18. Kid on the Moon — 2016, Most Inspirational

**Observed:** the [submission](https://2016.spaceappschallenge.org/challenges/solar-system/book-it-to-the-moon/projects/kid-on-the-moon) describes testing with children, voice support, self-directed hotspots and an explicit return journey. The linked [repository](https://github.com/allards/kidonthemoon) README and panorama HTML were read; its legacy fallback is not evidence of modern compatibility.

**Lunar comparison:** instructions should support exploration without taking control away, and an exit should be obvious. Clear aiming/return controls align with this; actual beginner feedback remains pending. Child profiles, emails and badges add no required value.

### 19. L.I.V.E. Glacier / Ice Cream Team — 2016, Galactic Impact

**Observed:** the original project URL returned 404. The [official follow-up](https://2017.spaceappschallenge.org/blog/ten-scoops-success-live-glacier) confirms the award and describes satellite-derived glacier motion alongside field photographs. It distinguishes later IceKing development and market validation from the hackathon. No project repository was observed.

**Lunar comparison:** a familiar ground view can complement a scientific quantity without becoming its measurement. Keep terrain rendering, horizon calculations and their limits explicit. Release identity already preserves the distinction between evaluated and later work; crowdsourcing is unnecessary.

### 20. Scintilla — 2016, Best Use of Data

**Observed:** the [submission](https://2016.spaceappschallenge.org/challenges/earth/aircheck/projects/scintilla) names satellite, ground-station, sensor and sentiment inputs and a user-facing AQI output. The linked [organization](https://github.com/scintilla-aircheck) exposes web/API/hardware repositories; their current presence does not identify the judged 2016 version. Accuracy was not verified.

**Lunar comparison:** keep the source → derived measure → decision relationship inspectable. Existing provenance and metric definitions cover this. An air-quality-style composite score would obscure separate sunlight/Earth trade-offs and is not adopted.

## Material evidence gaps

This is a source/material study, not a comparative usability or scientific benchmark. No old application was installed or exercised, no old judged commit was authenticated, and inaccessible source material was not reconstructed. Great Bloom's repository returned 404; L.I.V.E.'s project page returned 404 but its award and follow-up were available. Several others exposed descriptions or prototypes rather than verified functioning systems.

The implementation suggestions above remain suggestions unless recorded separately in the release evidence. At research handoff, the novice study, WebGL-disabled regression and event-jump feature had not been executed or implemented. The integration status below distinguishes subsequent work from research evidence. See [CLARITY-CORRECTIONS.md](CLARITY-CORRECTIONS.md) for corrections actually made and [VERIFICATION.md](VERIFICATION.md) for executed release checks.

## Applied in the motion/surface round
- Added a local, controllable four-step animated explanation of input -> horizon -> visible disc -> interval; it links directly to the real tools.
- Added inspection five minutes before/after the existing refined events. This pauses playback and changes only the inspected instant/view; no new physical model or ranking.
- Surface labels distinguish real terrain, observer alignment, illustrative brightness/grain, numerical horizon occlusion and optional light-path diagrams.
- Independent QA is assigned the core Compare/text/export flow with WebGL blocked. Its executed result belongs in release evidence, not in this research document before the check runs.
- The uncoached beginner study remains pending real participants. No claim that animation, expert review or automated tests prove comprehension.
