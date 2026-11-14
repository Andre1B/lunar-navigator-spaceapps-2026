# Learn page checkpoint ("How it works")

Owner of this slice: Claude Sonnet (464900fb). Files: `src/pages/Learn.jsx`, `src/content/learning.js`, this note. Nothing else was edited; not committed or published (root integrates).

## Status
Built and syntax-checked (esbuild transform of both files). NOT yet run in a browser, not linted, no tests run: root must integrate before any browser, keyboard, reduced-motion or Lighthouse check. Those checks are pending, not passed.

## Integration (root)
- `import Learn from "./pages/Learn.jsx"`; render `<Learn onStartTour={fn} onOpen={(route) => go(route)} />`. Both props optional; CTAs hide or no-op if missing.
- Routes the page calls through `onOpen`: `simulator`, `compare`, `mission`, `credits`. Add a nav/hash route for the page itself (e.g. `learn`).
- The page does not use `location.hash` for in-page jumps (buttons call `scrollIntoView`), so hash routing is not broken. Respects `prefers-reduced-motion` for scrolling.

## Content (all in `learning.js`)
Seven lessons: (1) Raise the observer (SVG cartoon, slider), (2) Shadow vs night (3 questions with feedback), (3) Faithful vs Free (dial, freeze Earth), (4) Reading the numbers (mean Sun disc vs direct sunlight vs longest darkness, computed from invented 24-hour examples), (5) 8-step manual stepper, (6) Limits, (7) Sources/AI/open source + glossary. Advanced detail sits in `<details>`.
Truth notes: all numbers in the demos are invented and labelled as such; no NASA numbers. The sources block states that the official interpretation of earlier AI-assisted ideation is unresolved and that NASA does not endorse the project. Do not remove either.

## CSS classes root must style
Layout/cards: `learn-page` `learn-module` `learn-module-intro` `learn-card` `learn-sim` `learn-facts` `learn-toc` `learn-chip` `learn-cta` `learn-limits` `learn-end` `learn-details` `learn-details-body` `learn-glossary`.
SVG parts: `learn-svg` `learn-sky` `learn-ground` `learn-pole` `learn-eye` `learn-label` `learn-ray` (+`ok` `blocked` `ghost`) `learn-sun` (+`on` `off`) `learn-ring` `learn-earth` (+`frozen`) `learn-dial` `learn-bar` (+`lit` `dark`).
Quiz: `learn-quiz` `learn-question` `learn-scene` `learn-ask` `learn-options` `learn-option` (+`chosen right` `chosen wrong` `reveal`) `learn-feedback` (+`good` `bad`) `learn-score`.
Other widgets: `learn-result` (+`good` `bad` `warn`) `learn-mode-grid` `learn-freeze` `learn-legend` `learn-key` (+`sun` `earth`) `learn-stats` `learn-terms` `learn-stepper` `learn-dots` (buttons get `active`/`seen`) `learn-step` `learn-nav`.
Reused existing classes: `page` `page-heading` `lead` `button` `button secondary` `caption` `mono` `section-label` `segmented` `inline`.
Colour must never be the only signal: right/wrong/hidden/visible are also stated in text.

## Pending / for tests
Independent tests (df6de34e) after root integrates: keyboard path through every widget, `aria-pressed`/`role=status` announcements, reduced motion, 390 px layout, quiz feedback text, stepper bounds, `onOpen` routes, no console errors.

## InteractiveTour.jsx fix (placement, hash close)
Only `src/components/InteractiveTour.jsx` edited. Card size is now measured (ResizeObserver + scrollHeight) instead of the fixed 250 px. `placeCard()` tries below, above, right, left of the target, accepts the first that fits inside a 16 px viewport margin without covering the spotlight, otherwise clamps and keeps the least-covering option. Short screens: card max-height is viewport minus 32 px and scrolls. Initial scroll keeps room for the card (`behavior: "auto"`, no smooth motion). Missing target: keeps looking about 2 s, then shows a centred card without a spotlight. Escape and non-modal controls unchanged. A `hashchange` to any route other than the current step's route closes the tour; the tour's own navigation targets the step's route so it is not treated as leaving.
Validated: esbuild transform OK; `placeCard` unit-checked in Node for below/above/side/tiny/no-target cases (node, not in repo). NOT run in a browser: real placement, resize, Escape, hash-close and focus return are pending for the test agent.
