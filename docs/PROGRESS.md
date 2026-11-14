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

FINAL RELEASE: production deployment **254df20f**, source documentation checkpoint 318e7d7, camera code b07e64a. **71/71** unit/data checks; **27/27** production browser checks; **10/10** separate six-slide demo checks. Final mobile Lighthouse all five categories 100; desktop Performance 99 and others 100. Zero browser console/page/request errors in tested flows. See docs/VERIFICATION.md and docs/release-evidence.json for evidence, report hashes, exact scope and untested GPU/browser/screen-reader cases. All public static source/build files matched hashes before deployment. No runtime source change after these release checks.

Do not call the project submitted or eligibility certified. Official interpretation of prior AI-assisted ideation remains unresolved; document assistance honestly. The NASA registration/eligibility/legal confirmations and Submit for Judging have NOT been performed. The user has authorized GitHub/Pages publication, not an unchecked legal submission.

## Budget

Initial read Codex 54% relevant allowance consumed; Claude five-hour 0%, weekly 9%. User has two manual resets; notify near limit and checkpoint, never consume a reset credit silently.

Last Codex allowance read at delivery: 66% used; two manual reset credits still available, none consumed. Continue checking before substantial new work.

## Resumption

Read this file, scientific/PROGRESS.md, tests/PROGRESS.md and docs/review-sol.md. Do not duplicate completed research or delete data. All delegated production/demo QA is finished; no reply is pending. Root owns subsequent build/publication and user feedback. Operational Cloudflare work is finished, with logs in the epic outside git. No additional hosting cleanup is needed. Preserve the actual public version until a new change is authorized; refresh the evidence for material changes.

## Active V2 checkpoint
The major tutorial/visual redesign is implemented locally and under independent verification. See docs/REDESIGN-V2.md for precise source/assets/ownership. V1 evidence above is historical and must not be reused as V2 evidence. Root allowance 81% used, two manual resets unconsumed. New unit/data/geometry suite 84/84; browser V2 is running independently; production V2 and Lighthouse not yet run. No additional Cloudflare project changes are authorized or needed. Keep credentials and private research outside git.

## Active physical-scale correction
User requires scientific simulation instead of game framing. Complete compressed/enlarged-body rendering removed. Full physical positions/radii, camera-only inspection, floating origin, improved Earth layers, true solar lighting, optical glare and camera bug fixes implemented. See REDESIGN-V2.md. Bounded Sol high review closed3P2 findings after native-rendered verification; broad independent QA still running. Build/unit suite passed locally (84); production not yet replaced. Allowance88%, no reset used. Preserve source/data ownership and do not touch other Cloudflare projects.


USER PAUSE: urgent shutdown. All work stopped; see PAUSED-CHECKPOINT.md. No deployment. Final worker/browser/performance gates pending.

## Resumed: winner-source research and review workflow (2026-11-14)
User explicitly resumed. Four official global-winner repositories were cloned/read outside the application, including two Brazilian teams; no installs or competitor code reuse. Competition-era revisions were distinguished from later rewrites. See WINNER-LESSONS.md and review-winners-transfer.md; detailed corrected notes appended to the existing private research TXT.
Implemented: three-minute Review route, shared comparison calculation path, local JSON export with UTC windows/provenance/derived-file integrity/build identity, lower-bound-aware constraint feedback and metric-specific explanations. Review source-point wording corrected after independent scientific review. Mobile imagery is now 1k, with recorded conversions; physical/visibility data unchanged. Worker, asynchronous shader preparation and staggered texture uploads retained. Preview mobile simulator Lighthouse improved from83 to96 performance (100 accessibility/best practices/SEO; TBT230ms). Those are preview measurements, NOT production validation. Review performance is being checked after removing its loading waterfall.
84 unit/data/geometry tests re-passed at resume; new report/browser tests remain with independent Claude test agent. Root source and docs edits do not count as their test pass. No new deployment yet. Codex94% last read; two user-authorized resets remain unused because reset execution is not exposed. Cloudflare protected projects untouched.


## User expanded research scope: 24 global winners
Explicit new request: study more than20 projects and transfer applicable strengths. Opus feb63b33 coordinates16 dossiers (4 refreshed,12 new); Sonnet464900fb studies8 additional2025 winners. Exact division is recorded in the private expanded-study files under epic/tmp. They do not edit the app. Findings must distinguish official awards, team claims, source evidence and hypotheses; no presumed judges' motives, invented repositories or execution of competitor scripts. Deeper source inspection is prioritized for the6-8 closest tools; absent repositories remain an explicit gap. Root will append the completed studies to the existing TXT and apply only compatible, testable changes. Pending independent QA still blocks production publication.


## Integration handed to Claude at Codex98%
24 dossiers completed,10 public repositories inspected with association/version caveats. The expanded private studies have been appended to the existing TXT. U1/U2/U4/U5/U7/U10 integrated;121 unit/data/integrity tests and directed A/B10/10 passed. The single mobile summary target was fixed to36px and rechecked; no broad rerun is claimed. Sol high source gate found no evidenced blocker. New science/UI source and tests are checkpointed together; production remains pending.
Claude feb63b33 now owns integration, following the accepted handoff; tests stay with df6de34e. Remaining compatible U3/U6/U9 plus24-project mapping, docs and production gates are assigned. Private task handoff contains exact commands/ownership/evidence. No reset used; tool cannot consume them. No source or hosting changes to any other project are authorized. Preserve eligibility transparency and use a candidate tag, never a submission claim.


## 2026-11-14 · Claude integration after handoff (base a7ab3f6)

- **U3:** arrival-date series in Compare (`src/lib/arrivalSeries.mjs`, `src/components/ArrivalSeries.jsx`). Same `eventSummary` as the table; lower bounds visible; "Use as arrival" sets the date; no ranking.
- **U6:** real worked example in Learn, Malapert at 1 m versus 5 m, read at run time from `sites/malapert-massif.json` metrics.
- **U9:** `SkyDescription` (Faithful only). It uses the same interpolated observation as the on-screen percentages; `SpaceSceneV2` now also emits `sunDetail`, `earthDetail` and `frozen`. The polite live region updates only after time settles.
- **Docs:** `docs/WINNER-LESSONS.md` now covers all 24 winners, with evidence, lesson and action (or the reason for not adopting). It supersedes and removes `review-winners-transfer.md`. Also updated: CREDITS, the visible research links (`content.js`), the summary HTML and TXT, and demo slide 3 (its screenshot is now labelled as an earlier version).
- **Checks:** `npm run build` passes, `npm test` reports 0 failures and `check:data` reports 8 files valid. Browser checks of U3, U6 and U9 are requested from the test agent df6de34e.
- **Next:** test results, then commit, push and a release-candidate tag, then a clean build, deployment of `lunar-navigator-2026` only, and production QA with Lighthouse.

## 2026-11-14 · Release candidates published (Claude)

- **RC1 `ea3f888`:** U3, U6 and U9 plus the 24-winner docs. Production QA by the test agent: u369 15/15, ab 10/10, review 12/12, v2 21/21, truescale mobile 1/1, demo 10/10.
- **RC2 `2827ecb`:** the desktop simulator scored 88 in Lighthouse because of 4k texture uploads. The desktop now loads 2k imagery first and switches to 4k on the first interaction.
- **RC3 `090c45e`:** Learn mobile scored 89 because of a lazy route chunk; the route is now loaded eagerly. The test agent rechecked textures (10/10), Learn and a smoke test in production.
- **Lighthouse on RC3:** 8 runs, performance 98–100 and accessibility 99–100.
- **Deployment and evidence:** RC3 is deployment `61c81cc1`. Evidence is in `docs/VERIFICATION.md` and `docs/release-evidence.json`.
- **Not done:** no NASA submission was made and no submission tag was created.
- **RC4 `42e12dc`:** LF line endings fix, after CI had failed `check:data` since a7ab3f6. CI is green, deployment is `52b32426`, the production data hashes match, and the simulator Lighthouse confirmation is 99/100.


## Clarity and bugs round - 2026-11-14 (IN PROGRESS)
- Human feedback: several new visitors could not explain purpose, comparisons or terminology. Prior laboratory QA did not establish comprehension.
- Ownership handed back: Codex root frontend/root/docs/deploy; science partner scientific/public-data; independent QA tests only. Claude temporarily rate-limited; partner is Sol medium and QA Luna high per playbook.
- Play-at-end reproduction confirmed on production in 14 preset/motion cases: no restart. Added Replay/Restart, status and scrub pause.
- Surface sky was a permanent-colour angular mask, not ground. Kept exact scientific occlusion, added high-contrast grey explanation, initial Sun framing, direct aiming buttons and lit-terrain navigation. No fabricated terrain/photometry.
- Five real computed heights 0.5/1/2/5/10 m. Science tests V1-V5 pass; 1/5 baseline and sky numerically/byte preserved. New test contract required multiple transitions inside one hour.
- Home purpose and primary comparison entry; plain-language ComparisonAnswer uses same summaries; optional technical detail; inspection snapshot does not mutate original inputs. Science reviewer found and closed that inspection-state regression in source; runtime check pending QA.
- Additional text bug corrected: rounded Sun/Earth fractions near zero/one no longer classify partial visibility as fully hidden/visible.
- Additional winner research: two observed official project repositories, cloned privately without checkout/hooks/LFS, selected code read but never executed/reused. Applied lessons documented in CLARITY-CORRECTIONS and original private TXT.
- Development matrix/regression and production gates IN PROGRESS. No current production pass claimed yet.
