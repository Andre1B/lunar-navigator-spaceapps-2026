# Production checkpoint

Started 2026-11-14 after 09:00 America/Sao_Paulo. Preserve the true history; do not backdate.

## Roles and ownership

- Codex GPT-6.1 Sol medium (c7a52caa): frontend/root/docs, integration, repository and new Pages publication.
- Claude Opus, configured medium (feb63b33): scientific/ and public/data/; own checkpoint scientific/PROGRESS.md.
- Claude Sonnet, configured medium (df6de34e): independent tests/; own tests/PROGRESS.md.
- Claude Sonnet, configured medium (464900fb): Cloudflare inventory/cleanup outside this repository; local operational log only, no credentials in git.
- Codex GPT-6.1 Sol high (7e2bdfb8): independent bounded review, docs/review-sol.md; completed, no P0/P1 found in reviewed scope.

## Human-approved requirements

English; Guided Mission about ten minutes; unrestricted Open Workspace for judges about three minutes. Separate Home/Mission/Simulator/Compare/Evidence/Credits. Faithful shared time; Free independent freezes, experimental label and no mission recommendation. Hide interface for immersive 3D; always offer return. NASA-like colors, original identity. Public GitHub, Apache-2.0 originals, credits in UI and files; summaries HTML/TXT. Use NASA challenge resources meaningfully.

## Implementation status

Public repository: https://github.com/Andre1B/lunar-navigator-spaceapps-2026 . Public site: https://lunar-navigator-2026.pages.dev/ . React/Vite/Three.js routes implemented. Dataset: four polar points, 1393 hourly samples, March 1–April 28 2027, observer heights 1/5 m. Seven other planets are isolated visual-context data with explicit barycentre-proxy limitations. Original/late/alternative windows use refined events for durations and hourly approximations for mean disc fraction. Mission notes persist across screens in memory only.

Surface camera now follows the lunar point at every time sample, uses local ENU orientation and a terrain-horizon wall. Independent review of all 1393 x 4 x 2 Sun/Earth directions found maximum separation 0.0007041 degrees against stored topocentric angles, within rounding. A render/update recursion introduced by the body-focus controls was found by browser QA and fixed with a reentrancy guard. Whole-period metrics and window metrics use explicitly documented sampling schemes.

Commits: 1d4cd5e initial implementation; bd3273c planetary context/demo/tests; b07e64a camera render recursion and valid credit links. More release evidence commits will follow. First public deployment 30b215cf is a preview baseline; final revised deployment pending below. Do not mistake a successful initial deploy for completed verification.

Credits cover direct/transitive JS packages and scientific Python tools, source and preserved notices. Aesthetic NASA Moon and historical Earth textures are distinct from the numerical DEM. Official supplied Space Apps logo is unchanged and credited. No competitor code/assets reused; studied projects linked separately. Summaries in public/summary.html and public/summary.txt; six-slide demo in public/demo/.

## Deployment constraints

Only publish new lunar project. Cloudflare onlyone account was selected after inventory; all existing exception sites remain untouched. Separate user-authorized cleanup removed 19 unrelated Pages projects and three unrelated Workers. Three inactive Workers with Durable Objects are retained to preserve data. Banks/storage and protected services are untouched. Operational credentials/logs remain outside git. Do not copy research chat TXT into this public repo (personal information).

## Verification gates still pending

PASS: 71 independent unit/data tests; deterministic regeneration of sky and four site JSONs matched hashes (manifest/validation differ only generated timestamp); production build; science/front-end bounded review; initial browser desktop/mobile keyboard/reduced-motion and immersive Escape/return checks. The last browser pass before body-focus changes was 20/20; final updated body-focus pass and production run are pending. Initial production Lighthouse mobile: performance 100, accessibility 100, best practices 100, SEO 92; robots and missing-path handling were fixed for the final run. A new Lighthouse agentic-browsing category was 50 on the initial baseline; proper 404/llms discovery resources now added, final audit pending.

Remaining: final new-code browser pass + production QA, final production Lighthouse, public asset/link/credits checks, demo navigation and final release evidence. Do not call the project submitted or eligibility certified. Official interpretation of prior AI-assisted ideation remains unresolved; document assistance honestly. The NASA registration/eligibility/legal confirmations and Submit for Judging have NOT been performed. The user has authorized GitHub/Pages publication, not an unchecked legal submission.

## Budget

Initial read Codex 54% relevant allowance consumed; Claude five-hour 0%, weekly 9%. User has two manual resets; notify near limit and checkpoint, never consume a reset credit silently.

## Resumption

Read this file, scientific/PROGRESS.md, tests/PROGRESS.md and docs/review-sol.md. Do not duplicate completed research or delete data. Sonnet test agent owns tests/ and has an outstanding production QA after root sends the final URL/deploy-ready message. Root owns final build, publication and evidence. Operational Cloudflare work is finished, with logs in the epic outside git. No additional hosting cleanup is needed.
