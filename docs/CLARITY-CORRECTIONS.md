# Clarity and simulation corrections

André reported that several first-time visitors could not explain what the app did, how to compare arrivals or what the displayed values meant. That user feedback takes precedence over our earlier internal checks. A passing Lighthouse score did not establish comprehension.

## Corrections

- **Purpose first:** the landing-delay question and a ready-to-use comparison are the primary entry. The simulator and Free experiments remain directly accessible.
- **Answer before method:** three plain-language scenario summaries use the same `comparisonRows` results as the table and JSON. They distinguish time with any sunlight from the mean visible solar disc. Technical measurements, user constraints and the full arrival-date series remain one disclosure away.
- **Unfinished intervals:** “at least” remains visible. No direction-of-change claim is made when either compared darkness interval is truncated by a window edge.
- **Inspection preserves the comparison:** inspecting a scenario uses temporary location and height state. Returning from the simulator retains the original inputs and results.
- **Height means height above the terrain:** 0.5, 1, 2, 5 and 10 m were calculated independently. They are not camera altitude or interpolated horizons. The 0.5 m case is particularly sensitive to unresolved ground and terrain-model error.
- **Surface sky:** the previous permanently dark fill was an angular horizon mask, not sunlit ground. The neutral-grey mask and explicit explanation now identify it as blocked sky. Its scientific occlusion is unchanged. The view starts toward the Sun, has direct Sun/Earth aiming controls, and links to the separate real-elevation terrain view for lighting. No fabricated first-person landscape or photometric model was introduced.
- **Playback:** Play at the end of coverage formerly did nothing. Replay now restarts the period and advances; Restart resets to the first sample paused. Scrubbing or changing Faithful/Free pauses the clock. Changing a camera, place or height may continue playback. The visible status explains each state.

## Additional winner research: lessons for comprehension

These are observations and design suggestions, not established reasons for the awards. No competitor code, design assets or prose was copied. The inspected repository HEADs are not asserted to be the exact versions judged.

### Cambridge Asteroids / Voxsteroid, 2021

[Official winning project](https://2021.spaceappschallenge.org/challenges/statements/when-light-curves-throw-us-curve-balls/teams/cambridge-asteroids/project/) confirms Best Use of Data and describes an input-to-output experiment: change an asteroid/light setup, then generate a curve. The linked [repository](https://github.com/Laurence-Cullen/Asteroids), inspected at `26c04f0dc1f21521f887dc9eec16d23e15e5e253`, separates rotation, light, display and curve controls. `Controls.tsx` and `RenderLightVectorModal.tsx` were read; nothing was executed.

**Suggestion applied:** describe the experiment as inputs, observable result and explanation. Preserve physical 3D scale while providing explicit aiming buttons. **Not adopted:** multiple floating modal controls or a remote Blender service; neither addresses our users' comprehension problem.

### Change Maker / SHINE, 2021

[Official winning project](https://2021.spaceappschallenge.org/challenges/statements/you-are-my-sunshine/teams/change-maker/project/) confirms Best Use of Technology and identifies a specific audience: homeowners using sunshine information. The linked [repository](https://github.com/ChangeMakerGroupEdition/Sunshine), inspected at `9d8288a2225f16752d7c10e0647016c3787d0991`, includes a skippable introduction and a separate explanation screen. Selected source ranges in `onboard_screen.dart` and `detail_screen.dart` were read, without running the app.

**Suggestion applied:** explicitly answer what it is, who it helps, what to change and why the output matters. Keep explanations close to the result rather than requiring a long tutorial. **Not adopted:** electrical savings or power estimates; our geometry does not model them.

### Greetings from Earth!! and Oogway Comics, 2023

The [NASA announcement](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners/) identifies the Brazilian Greetings from Earth!! as Galactic Impact and Oogway Comics as Art & Technology. It describes an ocean-garden framing and an exoplanet comic, respectively. Project detail pages could not be retrieved in this round; code, live interaction and judges' individual notes were not inspected.

**Suggestion applied:** lead with one understandable situation, then introduce the scientific terms. **Not adopted:** turning this simulator into a comic or a game. The human request requires a simulator.

## Release gates

The independent QA records the actual matrix, failures and retests in `tests/PROGRESS.md`. The release record must identify the current commit/deployment and distinguish development from production. Do not claim exhaustive bug-freedom or measured first-time comprehension without those checks and real user feedback. The previous 24-project study remains in [WINNER-LESSONS.md](WINNER-LESSONS.md).
