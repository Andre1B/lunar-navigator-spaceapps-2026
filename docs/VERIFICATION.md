# Verification evidence

This record distinguishes executed checks from pending release gates. It does not certify scientific precision in every geometry or competition eligibility.

## Motion and surface correction ? current gate in progress

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
