# Verification evidence

This record distinguishes executed checks from pending release gates. It does not certify scientific precision in every geometry or competition eligibility.

## Motion and surface correction - current gate in progress

The public site still runs RC5 (`3826c92`, deployment `66055be1`). Independent 60 Hz sampling found a real playback-text/layout flicker on that release. Its earlier green interaction checks did not detect the defect. RC5 is not a complete release sign-off.

The local correction is committed through `1c3c681`: retain last rendered readings with their frame UTC, stable status text, independent GPU playback with mobile 60 / desktop 120 FPS ceilings, a horizon-clipped real-terrain foreground, finite opening and tutorial animation, and event inspection. Independent bounded review closed the three evidenced lighting/publication/camera-frame findings.

Executed locally: production build, data integrity 8/8, credits 163 packages / 0 missing repository URLs, and tracked-text UTF-8 / secret-pattern checks. Independent new-UI checks passed 7/7 (opening, focus, reduced motion, tutorial, exact event inspection, surface options, glare occlusion, and comparison/export without WebGL). The strengthened flicker checks, legacy-suite triage, final hardware measurement, current-source production QA and production Lighthouse are still pending. Caps are not measured FPS, and automated checks do not establish novice comprehension or absence of every possible bug.

## Calendar / arranged score checkpoint (local, not a production sign-off)

Current local source `6392324` adds an original manifest-limited UTC calendar and a richer original80-bpm score. Root directed keyboard/date/coverage/invalid/empty/Escape checks passed;14 route/viewport states at1440/390 had no horizontal overflow or console/page errors. Native8.1s audio smoke created0contexts before a gesture,1after, produced nonzero RMS0.00590, observed at most7oscillators including4pads, and settledOff suspended. Source-only review closed a partial/impossible-date normalization finding by sharing strict UTC parsing with the calculation/export path. The independent full focused rerun remains pending; these are not production or novice-comprehension passes.

Intro and Reset reports were withdrawn after isolating harness errors: intro was inspected after its2.4s dismissal; Reset was compared with a preset composed at a different time before Restart. Preset reconstruction matched the appropriate12h/0h world-camera positions to floating-point precision. Tests retain separate expectations for each control.

## Latest local additions (not a production sign-off)

The current six-point dataset has ten integrity-checked core files; the four original site series, sky and original terrain tiles were byte-preserved. Independent browser coverage passed 420 combinations and 49 transitions before the optional edge/audio additions. The next focused checks cover those additions, repeatable opening with Home/deep-link preservation, music opt-in/lifecycle, settled text stability, touch and reset behavior. Earlier RC5 production flicker remains recorded as a real failure.

Root native smoke confirmed: Home remains after opening; no AudioContext is created before a music gesture; one running context produces nonzero analyser samples; it persists through route navigation and suspends with a held clock after Music Off settles. Optional edge outlines rendered, Sun following toggled, and no console/page errors appeared in those directed samples. These checks do not replace independent current-source production QA or Lighthouse.

## Historical RC3 / RC4 evidence (superseded) ? V2 true-scale simulator

**Release:** commit `090c45ec6c8756e07d26ef195bed372c54293b12`, tag `release-candidate-2026-11-14-3`. The tag is a candidate, not a submission.
**Deployment:** Cloudflare Pages deployment `61c81cc1` of `lunar-navigator-2026` at 2026-11-14T19:50:26Z, built from a clean tree. The bundle reports `build.dirty = false` and the same revision.

| Check | Result | Where it ran |
| --- | --- | --- |
| Unit, data, report, event, integrity and arrival-series tests | 128/128 | local |
| `check:data` (derived-file hashes) | 8/8 | local |
| Arrival series, worked example, text description (U3/U6/U9) | 15/15 | production RC1 `ea3f888` |
| Arrival skies A/B | 10/10 | production RC1 |
| Review | 12/12 | production RC1 |
| V2 routes and layout | 21/21 | production RC1 |
| True-scale mobile 390 subset | 1/1 | production RC1 (full matrix 21/22 in development, plus a mobile fix rechecked) |
| Demo | 10/10 | production RC1 |
| Texture loading and Learn recheck | 10/10, plus Learn and smoke | production RC3 |

- **Texture loading:** at 1440 px the simulator loads only 2k imagery until the first interaction. A drag, wheel, arrow key, "+" key or the Zoom button then makes exactly three 4k requests, with the same orientation. At 390 px it loads only 1k imagery.
- **Errors:** none on the console or network in these flows.
- **What changed between RC1 and RC3:** only desktop texture loading and the eager Learn route, both prompted by Lighthouse. Both were rechecked.

**Production Lighthouse 13.6** on RC3, run serially:

| Page | Form factor | Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- | --- | --- |
| Simulator | mobile | 98 | 99 | 100 | 100 |
| Simulator | desktop | 100 | 100 | 100 | 100 |
| Home | mobile | 100 | 100 | 100 | 100 |
| Review | mobile | 99 | 100 | 100 | 100 |
| Compare | mobile | 99 | 100 | 100 | 100 |
| Learn | mobile | 100 | 100 | 100 | 100 |
| Evidence | mobile | 100 | 100 | 100 | 100 |
| Credits | mobile | 100 | 100 | 100 | 100 |

- **Earlier failures on RC1/RC2:** two results fell below the gate and were fixed.
  - Desktop simulator scored 88. Three long tasks came from 4k texture uploads; desktop now starts with 2k imagery.
  - Learn mobile scored 89. The page waited for a lazily loaded route chunk; the route is now static. An A/B run showed the new worked example was not the cause.
- **Raw reports and hashes:** see [release-evidence.json](release-evidence.json).

**Limits:**
- These are laboratory runs in headless Chrome with SwiftShader.
- Real-device GPU, Safari, Firefox and a full screen-reader audit were not tested.
- The full true-scale browser matrix was not re-run in production.

**Historical deployment, RC4:** commit `42e12dc`, tag `release-candidate-2026-11-14-4`, deployment `52b32426` at 2026-11-14T20:00:08Z.
- **Change from RC3:** only the line endings of the dataset JSON (LF) and of the generators. No data values changed.
- **Why it was needed:** CI had failed `check:data` since `a7ab3f6`, because the integrity hashes covered Windows CRLF bytes.
- **CI on `42e12dc`:** success.
- **Production data:** `manifest.json` hashes to the same value recorded in `integrity.json`.
- **Confirmation Lighthouse on RC4:** simulator mobile 99/99/100/100, desktop 100/100/100/100.
- **Not re-run on RC4:** the RC3 browser QA, because only line endings changed.

## Historical v1 record (superseded)

The sections below describe the earlier v1 deployment `254df20f`. They do not certify the current version.

## Independent checks executed

- `npm test`: 71 passing analytic, dataset and planetary-context checks. No skipped/todo cases in the root execution. Test author: separate Claude Sonnet agent.
- Scientific regeneration in an isolated scratch output: sky and four site JSONs match byte hashes; manifest and validation differ only in generation timestamp. The independent test agent did not re-download all source data or repeat live Horizons access.
- Source-science validation: V1–V5 and context-only V4b are recorded in public/data/validation.json. V1 only covers the sampled instants and printed Horizons precision. V2's acceptance target was written after an exploratory run, explicitly documented.
- Independent Sol high review reconstructed all 1393 x 4 x 2 topocentric directions using the rendered quaternion/ENU mapping: maximum separation 0.0007041 degrees against the rounded stored angles. This is a consistency check, not validation of all visual effects.
- Browser/IAB first: inspected home, comparison and simulator; changed mode, checked freezes and entered immersive view. The browser tool could not reliably resize at its current zoom and could not send Escape through its button locator. Dedicated Playwright Chrome checks were therefore used for exact dimensions and native keyboard input.
- Playwright before final body-focus correction: 20/20 initial functional checks; later tests detected a camera recursion introduced by new focus controls. The recursion was fixed with a rendering reentrancy guard. Final rerun is recorded below when complete.
- Production build executed successfully with Vite 8. The 557 KB (138 KB gzip) Three.js chunk is lazy-loaded only for the simulator. The build warning is retained; it is not a failed build.
- Initial public production mobile Lighthouse: Performance 100, Accessibility 100, Best Practices 100, SEO 92. Robots/missing-path and discovery handling were corrected afterward, so the final audit must supersede this baseline.
- Before initial public commit: staged secret/private-key pattern scan, raw-cache exclusion and file-size scan returned no flags. No research chat or credentials are published.

## Visual comparison ledger

Reference: the private, visibly labeled generated concept `tmp/lunar-ui-concept.png` in the epic. Actual renders: `tmp/lunar-qa/desktop-home.png`, `desktop-simulator.png`, `desktop-compare.png`, `mobile-home.png` and simulator HUD states. Root opened the reference and implementation images with view_image.

1. **Palette:** true dark navy background, white text, blue primary actions and restrained red detail implemented with shared tokens; no purple hero wash or NASA brand imitation.
2. **Typography:** self-hosted Overpass and Fira Code, including explicit control typography. Desktop heading hierarchy and 390 px line wrapping visually inspected.
3. **Layout:** deliberately changed from one workspace to separate routes at the user's request. Home's two start actions and unrestricted evaluation link are prominent. The simulator does not contain the full credits or evidence page.
4. **Scientific media:** real, credited NASA imagery replaces the concept image. No generated texture or fake concept timeline was shipped. Overview and sky views identify scale/method limits. The terrain silhouette is numerical, not a picture of a selected landing site.
5. **Interactions:** Faithful/Free have separate behaviors; the intrusive interface can be hidden and restored. Mission progress never blocks navigation. Controls are real native elements with focus styling.
6. **Responsive repair:** Evidence numeric output was wrapped to remove 390 px overflow; header navigation now occupies two rows, preserving access to Credits. Simulator HUD and control placement were inspected at 1440/390 px.
7. **Copy differences:** the concept's invented 2030 date and simplified free-camera description were replaced by real dataset coverage and independent freezes. No fake figures or operational-safety claims were imported from the image. These are intentional scientific/user-required deviations, not unreported fidelity drift.

## Final release gates (v1, superseded)

Completed on production deployment **254df20f** at https://lunar-navigator-2026.pages.dev/:

- **71/71** unit/data tests, no failures or todo cases.
- **27/27** production browser checks: all routes, independent freezes, all body-focus options, changes to location/height/date/delay, unavailable/empty dates, mission-note persistence, native Tab/Space/Escape, immersive focus return, reduced motion, 1440/390 px layout, correct public file types and absolute source links. Zero failed requests, console errors or page errors in those flows.
- **10/10** separate production demo checks: six slides, real button clicks, keyboard navigation, deep-link loads, clamped bounds, image loading, all six slides at 1280x720 and 390x844, no overflow or CSP errors. Browser/IAB click failure was tooling/zoom; native Chrome confirmed no app bug.
- Final production **Lighthouse 13.6.0**: mobile 100 in Performance, Accessibility, Best Practices, SEO and Agentic Browsing. Desktop Performance 99; the other four categories 100. Largest Contentful Paint approximately 0.77 s mobile and 0.83 s desktop in these laboratory runs, not field guarantees.
- Native-size 1487x1058 production simulator screenshot captured after both NASA textures loaded, matching the generated reference's actual dimensions. Root reopened the reference and latest production image with view_image and checked the ledger above. Separate-screen layout and scientifically corrected copy remain deliberate, user-required departures from the initial concept.
- Public HTML/TXT summaries, six-slide demo, AI metadata, dependency credits, data files and source repository are accessible without an account.

Machine-readable results and raw-report hashes: [release-evidence.json](release-evidence.json). Native Chrome headless used SwiftShader: real-device GPU performance, Safari/Firefox and a full screen-reader audit remain untested. Color contrast and keyboard checks do not substitute for those unexecuted checks. No material unresolved failure was found against the agreed tested release criteria.

## Competition submission

Six-slide HTML demo prepared; not submitted to NASA. Registration/eligibility and legal confirmations have not been completed by this agent. Interpretation of the earlier AI-assisted ideation history remains unresolved. Source, assistance disclosure and truthful caveats must not be removed to claim eligibility.

## Rolling/PDF resume - 2026-11-15 (local integration)

The rolling dataset covers 2025-11-15 to 2027-11-15 UTC, 17,521 hourly samples. Science-owner checks passed V1-V7 (V4b informational); the limited cached V1 epochs are not independent validation of the entire two-year range. All ten public data hashes passed again after exact recovery of three missing generator sources. No numerical data changed during source recovery.

Root ran check:data (10/10), credits (186 packages, 0 missing repository URLs) and a production build. A local PDF download completed without browser runtime or network errors; the 60-page report includes the final valid arrival, 2027-11-08, and had no out-of-page text boxes or NaN values. First, measurement and last pages were checked visually.

The user connected Lunar Pages to the original GitHub main branch. Read-only configuration inspection confirmed the destination; the previously empty build configuration was corrected for this project only. The daily workflow commits validated data for the connected Pages build without a Cloudflare credential.

### Git connection artifact / production recovery
At 03:31 UTC on 2026-11-15, independent QA reported raw /src/main.jsx and a blank app from deployment 8ac85602. Its 02:53 creation preceded the correction of the empty Pages build settings at 03:05. Root restored the existing compiled RC5 deployment 66055be1; HTTP 200 then referenced /assets and no source JSX. The build configuration is npm run check:data && npm test && npm run build, with output dist.

## Current candidate local gate - 2026-11-15
The integrated suite passed 168/168 unit/data tests with no skips or todos; 10/10 data checks, 186-package credits and the build passed. Independent focused browser checks, six settled text/clock cases and 13/13 Review/Compare passed on app source 13e4616. The legacy suite has an explicit 22-case retirement/current-equivalent ledger in tests/PROGRESS.md.

## Public candidate gate - 2026-11-15
Source 2b910fc was published through the GitHub integration as deployment ea180be8 (dirty false). Independent production QA passed 20/20: entry 5/5, playback 2/2 containing six settled cases, Review/Compare 13/13, with no console, page, HTTP or request errors. Actual PDF and JSON files were downloaded; all six clock/text traces had zero base or presented backslides.

Eight serial Lighthouse 13.6.0 runs used native headless Chrome with an observed NVIDIA RTX 3060 / D3D11 renderer and passed: performance simulator mobile 91 / desktop 97, Home 99, Compare 90, Review 98, Learn 99, Evidence 98, Credits 98; accessibility 99-100, best practices and SEO 100. The earlier forced-SwiftShader simulator run scored 58 with about 49 s simulated TBT and remains a documented limitation; it is not replaced by a hardware-independent claim. Raw report hashes are in release-evidence.json.

Official Submission Guide, Judging and Awards Guide, Participant Terms and challenge Details/Resources were read live. docs/SUBMISSION-PACKET.md holds English field text and a 29-second storyboard. No video was rendered or uploaded, no Terms were accepted and no project was submitted.

## Daily refresh to public deployment - 2026-11-15
Fresh Linux run 43678852498 (workflow_dispatch, publish=true, force_refresh=true; Ubuntu, Python 3.12, Node 24, no warm cache) fetched and checked all locked inputs, regenerated all six points, passed V1-V7, data integrity, 168 tests, credits (191 packages, platform-specific) and the build, then pushed the clean bot commit 9de8980 at 05:05:43 UTC.

A first read of Cloudflare history shortly afterwards did not yet list it. A later read-only inspection showed that the bot push did trigger the Git integration: deployment 7624424a (trigger github:push, commit 9de8980, dirty false) was created at 05:05:46 UTC and finished deploying at 05:06:47 UTC, with no human push involved. The next human push, dd0d3e9, became production deployment b7e8780b (github:push, dirty false). No deploy hook, Cloudflare token or additional secret was created; the Git integration responds to pushes made with the workflow's own token.

Production at https://lunar-navigator-2026.pages.dev serves the regenerated dataset: integrity.json is byte-identical to the repository and 10/10 data files match their recorded size and SHA-256 (manifest generated 2026-11-15T05:04:58Z, 17,521 samples). The HTML references compiled /assets bundles only. App source is unchanged since 2b910fc, so the 20/20 production QA and Lighthouse results above still describe the served application. The six-slide demo numbers (for example Malapert massif 289 h to 144 h, Connecting ridge Sun elevation -2.00 to -0.09 degrees) were recomputed from the regenerated data with the app's own event-refined method and match.

The scheduled trigger (03:37 UTC daily) uses the same publish step; its first scheduled execution had not yet occurred at this record. GitHub may delay scheduled runs.

## Release candidate 2026-11-15-1
Tag release-candidate-2026-11-15-1 marks the documentation commit that records this evidence. It is a release candidate, not a competition submission. Remaining human items: team/event confirmation, binding Terms and original-work assent, the unresolved interpretation of AI-assisted ideation, and the choice between the six-slide demo and a recorded 29-second video. Not established: physical-phone, Safari or Firefox performance, a full screen-reader audit, sustained 60 FPS, good software-GPU performance and measured novice comprehension.
