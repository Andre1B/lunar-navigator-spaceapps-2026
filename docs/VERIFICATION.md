# Verification evidence

This record distinguishes executed checks from pending release gates. It does not certify scientific precision in every geometry or competition eligibility.

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

## Final release gates

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
