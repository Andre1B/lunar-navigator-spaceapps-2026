# Active work: user-requested full UX / visual redesign

The user rejected the first production 3D as ugly and requested: a complete tutorial, immediate clarity about purpose/use/benefit, maximum meaningful interactivity, animations across pages, much better 3D, and more vivid colors. This is the active task; do not hand off v1 as final or ask permission to continue. Preserve v1 production until the redesign is validated.

## Baseline

v1 public https://lunar-navigator-2026.pages.dev/ ; GitHub Andre1B/lunar-navigator-spaceapps-2026; latest committed fd586a9; deployed254df20f. 71 unit/data,27 browser,10 demo checks passed; Lighthouse mobile100 all5categories,desktopPerf99/rest100. This evidence does NOT validate new redesign code. Local dev server8651a9b4 was stopped; restart npm run dev -- --port5173 when needed. Never change other Cloudflare projects; prior user cleanup is finished.

## Roles / current handoffs

- Root Codex Sol medium owns frontend, styles, docs, integration, GitHub and new lunar deployment. Last quota66%, two manual reset credits unused; warn near limit, no automatic reset.
- Claude Opus medium feb63b33 owns scientific/ and public/data/. New real global elevation, local terrain, star map and visual assets are already generated (below). No commit by Claude; root integrates. Available for scientific review of new WebGL.
- Claude Sonnet medium464900fb (renamed Lunar — tutorial e explicação) delivered only src/pages/Learn.jsx,src/content/learning.js,docs/tutorial-progress.md. Seven interactive lessons, optional props onStartTour/onOpen. Root must style learn-* classes and add learn route. Syntax-checked only, no QA. Agent finished.
- Claude Sonnet df6de34e remains independent tests/ owner. Await root signal after integration; no new QA yet.
- Sol high reviewer7e2bdfb8 reviewed baseline only; do not count this as v2 review.

## New visual reference

One new image generation, private tmp/lunar-redesign-concept-v2.png in epic. The original generation reference is private and is not part of the repository. Viewed. It is an AI-labeled design reference, not a shipped scientific texture. Main scene: close, detailed lunar south-pole foreground, blue Earth, real star background, vivid cyan/blue/gold UI, readable camera presets and obvious Take a tour/Explore fullscreen. Header Home/Learn/Explore/Compare/Evidence/Credits. Compact left setup and bottom time controls, short Try this explanation. Scientific corrections: height only1/5m, real date coverage, never move Sun for attractive light, no fabricated data, free experiments labeled, real scales in sky, overview scale adjustments explicit. No NASA identifier in generated image; official unchanged Space Apps logo remains separately credited.

## Implementation plan (not yet coded at this checkpoint)

1. Add Learn route and full in-app nonmodal interactive tour (~10 anchored steps across home/simulator/compare/evidence/Free). Tour targets data-tour attributes; Next/Back/Skip/close/Escape, focus restoration, keyboard/mobile, reduced motion. Underlying tools remain usable; never lock judges out.
2. Rewrite Home for immediate clarity: lunar light/terrain/Earth/date comparison, why useful, two distinct start choices, quick review, How it works, real actions. Vivid shared design tokens, no vague telemetry.
3. Rework simulator to scene-first workspace: named camera presets Moon & Earth / South pole / Surface sky / Local terrain / Solar context, compact setup/location/height, larger scene, labels, clear timeline/playback and contextual Try this. Keep immersive return and Free warnings.
4. Rebuild SpaceScene cleanly with a scheduled render loop (no recursive OrbitControls update). Real displaced global mesh + physical normals, actual source textures, ICRF star sphere, real Sun direction, local terrain mesh. Body positions/quaternions stay source-driven. Use named camera compositions to show Moon foreground and Earth; overview scale explicitly adjusted. Sun/Earth sky remains true angular size with DEM horizon wall. Local view is oblique overview, NOT a claim of a 1m eye over a40mDEM.
5. Improve animations: page entrances, meaningful selected-state transitions, eased camera moves, smooth time animation if all numeric readouts remain correctly sampled/labeled. Honor reduced motion; no autoplay by default. Consider memoizing static timeline bars to avoid repeated thousands of React rects if time becomes fractional.
6. Style all pages and new Learn widgets coherently; preserve evidence, constraints and credits/AI caveats. Add new conversion-tool credits and asset provenance. Update summaries/demo only after real new screenshots exist.
7. Independent new tests and scientific geometry review, browser mobile/desktop/keyboard/reduced-motion, production Lighthouse>=90; commit checkpoints, deploy lunar only.

## Real asset contracts delivered by Claude

### Global relief: public/data/globe/
moon-elevation-1440x720.i16 (2.07MB) desktop; moon-elevation-720x360.i16 (.52MB) mobile; moon-elevation.json metadata. Raw signed int16 little-endian, row-major METRES above radius1737400m, no no-data. Pixel centres lat=90-(r+.5)*180/H,lon=-180+(c+.5)*360/W. SphereGeometry UV u=(lon+180)/360,v=1 north: sample row=(1-v)*H-.5 with proper clamped/wrapped bilinear sampling. Native mesh maps ME->Three P(x,y,z)=(x,z,-y), body quaternion remains (-q1,-q3,q2,q0) for SPICE wxyz J2000->body. Scale vertex radius by1+h/1737400; compute normals after displacement. Vertical scale1; any exaggeration must be optional/labeled visual-only. Relief is display geometry, never changes site visibility metrics.

### Visual textures: public/data/globe/
moon-color-lroc-4096x2048.jpg (2.06MB desktop) and2048x1024(.53MBmobile), from NASA SVS2025 16bit LROC albedo, linear conversion16bit/257 to8bit sRGB/JPEGq90, no contrast change. earth-visual-2k.jpg(.35MB) resampled from original March2004 Blue Marble PNG (original still public/assets untouched). visual-assets.json lists source hashes/conversions/credits. Use new JPEG for performance; original8MB PNG can remain archived until migrated. Color/elevation grid centred0longitude, north row0. Mare Crisium59E at u.66, Tycho-11E/-43N.

### Local terrain: public/data/terrain/
terrain.json +4 files `<siteid>-20km-40m.i16`:500x500 int16 LE metres above radius1737400. x=xMin+(c+.5)*40, y=yMax-(r+.5)*40 in south polar stereographic, lon0+Y,90E+X. metadata includes boundsPolarStereoM,siteXYM,minM/maxM,siteTerrainHeightM,fractionFromPgda5m(.64-.79),hash. PGDA5m averaged8x8, PDS80m outsidecoverage. Site at row/col249.5. Inverse rho=hypot(x,y),lat=-90+2atan(rho/(2R)),lon=atan2(x,y). Exact ME point=(R+h)*(coslatcoslon,coslatsinlon,sinlat); use sphere curvature (29m over10km), not flat plane. ENU E=normalize(bodyNorth cross U),N=U cross E. Local positions dot(P-O) with E,N,U or absolute scaled ME coords+body quaternion. Mobile lower mesh resolution OK, label visualgeometry40m. No eye-level1m accuracy claim; horizonwall separately uses720siteprofile.

### Star map: public/data/starmap/
starmap-2020-celestial-4096x2048.jpg2.2MBdesktop,2048x1024.jpg.43MBmobile; starmap.json. NASA SVS4851, Gaia DR2 ESA/Gaia/DPAC. Converted half-float linear EXR->sRGB JPEGq88, no exposure change. ICRF/J2000 plate carree: RA=(180-(c+.5)*360/W) mod360,Dec=90-(r+.5)*180/H. RA0centre,increasesLEFT; on Three SphereGeometry set repeat.x=-1,offset.x=1,wrapS RepeatWrapping,BackSide,worldP axes,NO Moon rotation. Label real catalogue positions, illustrative brightness/color; no proper motion/aberration. Normal perspective is already gnomonic. Background sphere must be behind bodies and fit far plane; depthWritefalse/fogfalse.

### New optional tool credits

Pillow HPND (python-pillow/Pillow), OpenEXR BSD-3(AcademySoftwareFoundation/openexr),imagecodecs2026.11.11 BSD-3(cgohlke/imagecodecs) are actually used by optional conversion scripts. Add to UI and CREDITS; originals retain terms. Scientific requirements/README/PROGRESS already updated by Claude.

## Remaining scientific/eligibility caveats

Do not remove earlier AI-assisted ideation disclosure or claim official eligibility resolved. Original code Apache2, data/brands retain terms. NASA site submission not performed. Planet barycentre proxies remain visual-only. Sunlight is not power/battery; Earth geometry is not a radio link or DSN schedule. Preserve all sources and independent evidence; v1 passes are historical until new QA.


## Integration checkpoint ? 2026-11-14, V2 under verification

Implemented HomeV2, SimulatorV2, SpaceSceneV2, TimelineV2, Learn route and ten-step nonmodal tour. Named cameras, smooth interpolated visual time, physical terrain displacement, isotropic polar data, physical-baseline normals, catalogue stars, source imagery, independent freezes and immersive return are integrated. Mobile settings collapse, tutorial opens them; key readouts are larger. Home Free entry opens the workspace directly; Faithful opens the guided mission.

Astra completed bounded direction and actual-render critique. Its viewport, typography and purpose findings were applied. Claude reconstructed 1592 sampled Sun/Earth topocentric directions: max 0.00070 degrees against rounded source values; wall convention checked algebraically, not executed in that review. Test agent first run 84/84, found Learn ridge destructuring bug; root fixed it. New complete browser QA and production Lighthouse remain pending, so V2 is not declared released. Current baseline site remains v1.

Actual private V2 screenshots: ../tmp/lunar-qa-v2. Reference concept remains private and is not deployed. New asset conversions and optional tool credits added to CREDITS and Sources, AI metadata includes Astra art direction. Scientific data ownership remains Claude; tests ownership remains df6de34e. Do not repeat old passed gates as V2 evidence.

## Physical-scale correction - 2026-11-14

Latest user requirement supersedes the earlier compressed overview: this is a scientific simulator, not a game. Every solid 3D body uses its documented radius and full ephemeris position in the same unit system. Named cameras provide Moon orbit, Earth inspection, polar/local/sky views, true Earth-Moon separation and the full solar system. Camera approach never rescales a body. Default study epoch is explicitly 2027-03-01 12:00 UTC. Guided analysis remains a tutorial, not a progression lock.

Implemented: camera-relative rendering origin; actual solar point-light position for global bodies and local directional terrain shadows; 4k NASA Earth ground, CC BY4 SSS illustrative cloud/specular layers, inexpensive optical atmosphere/glare; stable orbit basis for changing up vectors with Three pinned0.187.0; input cancels camera transitions; zoom and all-body exclusion bounds; local150m terrain camera clearance; keyboard/touch/orbit controls; live scene visibility from the same interpolated geometry as the exact time. Free scene metrics are hidden. Scene snapshot is exposed read-only only for ?qa=1 test sessions.

Independent Sol high review found and verified fixes for three P2 issues: fractional-time HUD mismatch, entering non-focused Earth in pair view, antiparallel-up transition flip. Final report: docs/review-sol.md. No unresolved evidenced P0/P1/P2 in that bounded review. Full seven-view/two-mode native browser matrix and production Lighthouse remain pending. Do not reuse v1 or earlier V2 scores. Actual captures and review canvas are private epic tmp/lunar-true-scale and artifacts/lunar-true-scale-review. Codex allowance88%; manual resets intact.
