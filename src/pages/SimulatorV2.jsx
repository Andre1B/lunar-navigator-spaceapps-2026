import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Timeline from "../components/TimelineV2.jsx";
import NextEvents from "../components/NextEvents.jsx";
import SkyDescription from "../components/SkyDescription.jsx";
import { percent, timeAt } from "../lib/analysis.mjs";
const Scene = lazy(() => import("../components/SpaceSceneV2.jsx"));
const cameras = [
  ["overview", "Moon orbit", "Inspect the lunar globe"],
  ["earth", "Earth", "Inspect our home planet"],
  ["south", "South pole", "Look down on the region"],
  ["sky", "Surface sky", "Horizon diagram: what blocks your view"],
  ["terrain", "Local terrain", "Real 3D terrain, light and shadows"],
  ["pair", "Earth–Moon scale", "See the real separation"],
  ["system", "Solar system", "True sizes and distances"],
];
const name = (s) => s?.name?.split(" (")[0] ?? "Loading…";
const NO_FREEZE = Object.freeze({});
export default function SimulatorV2({
  dataset,
  index,
  setIndex,
  mode,
  setMode,
  siteId,
  inspecting = false,
  setSiteId,
  height,
  setHeight,
  onTour,
  tourActive = false,
}) {
  const { manifest, sky, sites, planets } = dataset;
  const [view, setView] = useState("overview"),
    [immersive, setImmersive] = useState(false),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(6),
    [freeze, setFreeze] = useState({}),
    [insight, setInsight] = useState("time");
  const [inspection, setInspection] = useState(null);
  const [observation, setObservation] = useState(null);
  useEffect(() => {
    setInspection(null);
  }, [view]);
  const [setupOpen, setSetupOpen] = useState(
    () => tourActive || !matchMedia("(max-width:720px)").matches,
  );
  useEffect(() => {
    if (tourActive) setSetupOpen(true);
  }, [tourActive]);
  const enter = useRef(null),
    back = useRef(null),
    wasImmersive = useRef(false),
    clock = useRef(index);
  clock.current = index;
  const site = manifest?.sites.find((s) => s.id === siteId),
    data = sites[siteId];
  const atEnd = !!manifest && index >= manifest.period.sampleCount - 1;
  function restart(play = false) {
    clock.current = 0;
    setIndex(0);
    setPlaying(play);
  }
  function togglePlayback() {
    if (atEnd && !playing) restart(true);
    else setPlaying((v) => !v);
  }
  useEffect(() => {
    const f = (e) => {
      if (e.key === "Escape") setImmersive(false);
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("immersive-active", immersive);
    if (immersive) back.current?.focus();
    else if (wasImmersive.current) enter.current?.focus();
    wasImmersive.current = immersive;
    return () => document.body.classList.remove("immersive-active");
  }, [immersive]);
  useEffect(() => {
    if (!playing || !manifest) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = Math.min(now - last, 200);
      last = now;
      const next = Math.min(
        clock.current + (delta / 1000) * speed,
        manifest.period.sampleCount - 1,
      );
      clock.current = next;
      setIndex(next);
      if (next >= manifest.period.sampleCount - 1) setPlaying(false);
    }, 50);
    return () => clearInterval(timer);
  }, [playing, speed, manifest, setIndex]);
  function changeMode(m) {
    setPlaying(false);
    setMode(m);
    setFreeze({});
  }
  const motions = [
    ["earthPosition", "Earth’s position"],
    ["earthRotation", "Earth’s rotation"],
    ["moonRotation", "Moon’s orientation"],
    ["sunPosition", "Sun’s position"],
    ...(planets?.planets ?? []).map((p) => [
      "planet-" + p.id,
      p.name + " position",
    ]),
  ];
  return (
    <main
      id="main"
      tabIndex={-1}
      className={"explorer-page " + (immersive ? "immersive" : "")}
    >
      <div className="explorer-heading">
        <div>
          <h1>See what the lunar terrain hides.</h1>
          <p>
            Press Play to move time. Does the Sun clear the hills? Can this
            place see Earth? Change the height, then compare an arrival delay.
          </p>
        </div>
        <div className="explorer-actions">
          <button className="button secondary" onClick={onTour}>
            Take a tour
          </button>
          <button
            ref={enter}
            className="button"
            onClick={() => setImmersive(true)}
          >
            Explore fullscreen
          </button>
        </div>
      </div>
      <div className="explorer-layout">
        {inspecting ? (
          <p className="inspection-note">
            Inspecting a comparison snapshot. Your original location and dates
            are preserved. <a href="#/compare">Return to your comparison →</a>
          </p>
        ) : null}
        <aside
          className={"explorer-setup " + (setupOpen ? "" : "setup-collapsed")}
        >
          <button
            className="setup-toggle"
            aria-expanded={setupOpen}
            onClick={() => setSetupOpen((v) => !v)}
          >
            <span>
              {name(site)} · {height} m ·{" "}
              {cameras.find((c) => c[0] === view)?.[1]}
            </span>
            <strong>{setupOpen ? "Close settings" : "Change view"}</strong>
          </button>
          <div className="panel-title">
            <h2>Your view</h2>
            <p>Choose a place, then watch time change the answer.</p>
          </div>
          <div data-tour="sim-location">
            <label htmlFor="explorer-site">Location</label>
            <select
              id="explorer-site"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              {manifest?.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {name(s)}
                </option>
              ))}
            </select>
            <label htmlFor="explorer-height">Observer height</label>
            <select
              id="explorer-height"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            >
              {(manifest?.observerHeightsM ?? [1, 5]).map((h) => (
                <option key={h} value={h}>
                  {h} m above the ground
                </option>
              ))}
            </select>
          </div>
          <p className="height-explainer">
            Height of your eyes, camera or antenna above the ground — not the 3D
            camera altitude. Small height changes can clear a nearby ridge.
            {height < 1
              ? " At 0.5 m, unresolved ground details can strongly affect the result."
              : ""}
          </p>
          <div className="camera-presets" data-tour="camera-presets">
            <h3>Camera</h3>
            <label className="sr-only" htmlFor="explorer-view">
              View
            </label>
            <select
              id="explorer-view"
              value={view}
              onChange={(e) => setView(e.target.value)}
              className="camera-select"
            >
              {cameras.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            {cameras.map(([id, label, explain]) => (
              <button
                key={id}
                aria-pressed={view === id}
                onClick={() => setView(id)}
              >
                <span>{label}</span>
                <small>{explain}</small>
              </button>
            ))}
          </div>
          <details className="explorer-help">
            <summary>What are these locations?</summary>
            <p>Published lunar study points, not certified landing sites.</p>
            <a href="#/evidence">Sources and coordinates</a>
          </details>
        </aside>
        <div className="explorer-main">
          <div className="explorer-mode" data-tour="sim-mode">
            <div className="segmented">
              <button
                aria-pressed={mode === "faithful"}
                onClick={() => changeMode("faithful")}
              >
                Faithful Mode <small>Real positions, one shared time</small>
              </button>
              <button
                aria-pressed={mode === "free"}
                onClick={() => changeMode("free")}
              >
                Free Mode <small>Freeze individual motions</small>
              </button>
            </div>
            <span className="explorer-mode-note">
              {mode === "faithful"
                ? "Positions follow the selected time."
                : "Artificial configuration · not for mission decisions"}
            </span>
          </div>
          {mode === "free" ? (
            <details className="free-lab" open>
              <summary>Freeze an individual motion</summary>
              <p>
                Each selection holds that position or orientation at the current
                time. Positions are relative to the Moon.
              </p>
              <div className="freeze-controls">
                {motions.map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={freeze[key] !== undefined}
                      onChange={(e) =>
                        setFreeze((f) => {
                          const n = { ...f };
                          if (e.target.checked) n[key] = index;
                          else delete n[key];
                          return n;
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              <button onClick={() => changeMode("faithful")}>
                Reset to Faithful Mode
              </button>
            </details>
          ) : null}
          <section className="explorer-world scene-frame" data-tour="scene">
            <Suspense
              fallback={
                <p className="scene-loading">Preparing the 3D explorer…</p>
              }
            >
              <Scene
                sky={sky}
                planets={planets}
                index={index}
                freeze={mode === "free" ? freeze : NO_FREEZE}
                view={view}
                site={site}
                siteData={data}
                height={height}
                onViewChange={setView}
                onFocusChange={setInspection}
                onObservation={setObservation}
              />
            </Suspense>
            <div className="world-meta">
              <span>
                {inspection
                  ? "Inspecting " +
                    inspection[0].toUpperCase() +
                    inspection.slice(1)
                  : cameras.find((c) => c[0] === view)?.[1]}
              </span>
              <span>
                {view === "sky"
                  ? "Horizon diagram · true apparent sizes"
                  : view === "terrain"
                    ? "20 km terrain window · visual geometry"
                    : "Physical sizes & distances · camera zoom only"}
              </span>
            </div>
            {!immersive &&
            data &&
            mode === "faithful" &&
            (view === "sky" ||
              view === "terrain" ||
              (!inspection && ["overview", "south"].includes(view))) ? (
              <div className="world-reading">
                <span>
                  <i className="sun-dot" />
                  Sun in view{" "}
                  <strong>
                    {percent(
                      observation?.siteId === siteId &&
                        observation?.index === index &&
                        observation?.height === height
                        ? observation.sun
                        : null,
                    )}
                  </strong>
                </span>
                <span>
                  <i className="earth-dot" />
                  Earth in view{" "}
                  <strong>
                    {percent(
                      observation?.siteId === siteId &&
                        observation?.index === index &&
                        observation?.height === height
                        ? observation.earth
                        : null,
                    )}
                  </strong>
                </span>
                <small>
                  {mode === "free"
                    ? "Separate faithful reference · not the artificial sky"
                    : name(site) +
                      " · " +
                      height +
                      " m · interpolated geometry"}
                </small>
              </div>
            ) : null}
            {immersive ? (
              <>
                <button
                  ref={back}
                  className="return-workspace"
                  onClick={() => setImmersive(false)}
                >
                  Return to workspace · Esc
                </button>
                <span className="immersive-mode">
                  {mode === "free"
                    ? "Free Mode · artificial geometry"
                    : "Faithful Mode"}{" "}
                  ·{" "}
                  {view === "sky"
                    ? "true angular scale"
                    : "physical body sizes & distances"}
                </span>
              </>
            ) : null}
          </section>
          {!immersive ? (
            <p className="readout-guide scene-navigation-help">
              {view === "sky"
                ? "Drag to look around."
                : "Drag to orbit the view."}{" "}
              Scroll to zoom, or open Navigation for camera buttons.
              {view === "earth" || inspection === "earth"
                ? " Clouds are an illustration, not live weather."
                : ""}
            </p>
          ) : null}
          {!immersive && mode === "faithful" ? (
            <p className="readout-guide">
              Sun / Earth in view: the percentage of each disc above the hills{" "}
              <strong>at this instant</strong>. 100% means the whole disc; 0%
              means hidden. These are not percentages of time or power.
            </p>
          ) : null}
          {view === "sky" ? (
            <aside className="sky-view-guide">
              <div>
                <strong>
                  This is a horizon diagram, not a photograph of the ground.
                </strong>
                <p>
                  Grey means terrain blocks that part of the sky. It does not
                  mean the ground is dark. The Sun is small because its apparent
                  size is real. Use “Look at Sun” to find it.
                </p>
                {mode === "faithful" &&
                observation?.siteId === siteId &&
                observation?.height === height &&
                observation?.index === index ? (
                  <p>
                    {observation.sun > 0
                      ? "Some direct sunlight reaches this observer now."
                      : "The terrain hides the Sun from this observer now."}{" "}
                    {observation.earth > 0
                      ? "Earth is also in view."
                      : "Earth is out of view."}
                  </p>
                ) : null}
              </div>
              <button onClick={() => setView("terrain")}>
                See sunlit terrain
              </button>
            </aside>
          ) : null}
          {view === "terrain" ? (
            <p className="view-explainer">
              Real elevation data, with sunlight from the selected time. This is
              an overhead view of a 20 km patch. For what an observer at{" "}
              {height} m can see over all the hills, choose Surface sky.
            </p>
          ) : null}
          <section className="explorer-time" data-tour="time-controls">
            <div className="playback">
              <div className="playback-buttons">
                <button
                  className="button play-button"
                  disabled={!manifest || !data}
                  aria-pressed={playing}
                  onClick={togglePlayback}
                >
                  {playing ? "Pause" : atEnd ? "Replay from start" : "Play"}
                </button>
                <button disabled={!manifest} onClick={() => restart(false)}>
                  Restart
                </button>
                <button
                  disabled={
                    !manifest || index >= manifest.period.sampleCount - 1
                  }
                  onClick={() =>
                    setIndex((i) =>
                      Math.min(
                        Math.floor(i) + 1,
                        manifest.period.sampleCount - 1,
                      ),
                    )
                  }
                >
                  Step +1 h
                </button>
              </div>
              <div className="clock-display">
                <span>Simulation time · UTC</span>
                <strong>
                  {manifest
                    ? timeAt(manifest.period, index)
                        .slice(0, 16)
                        .replace("T", " ")
                    : "Loading…"}
                </strong>
              </div>
              <label className="inline">
                Speed
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  <option value="1">1 hour / second</option>
                  <option value="6">6 hours / second</option>
                  <option value="24">1 day / second</option>
                </select>
              </label>
            </div>
            <p className="playback-status" role="status">
              {playing
                ? `Playing · ${speed} simulated hours per second. Press Pause to inspect a moment.`
                : atEnd
                  ? "End of the calculated period. Replay starts again on 1 March 2027."
                  : "Paused. Press Play, step one hour, or drag the time slider."}
            </p>
            <div data-tour="light-tracks">
              {manifest ? (
                <Timeline
                  compact
                  data={data}
                  height={height}
                  period={manifest.period}
                  index={index}
                  onChange={(value) => {
                    setPlaying(false);
                    clock.current = value;
                    setIndex(value);
                  }}
                />
              ) : (
                <p role="status">
                  {dataset.status === "error"
                    ? "Dataset unavailable. Open Evidence for details."
                    : "Loading the documented sky and visibility data…"}
                </p>
              )}
            </div>
          </section>
          <p className="simulator-next">
            <a href="#/compare">
              What if arrival is delayed? Compare the results →
            </a>
            <a href="#/learn">Explain these measurements</a>
          </p>
          <div className="explorer-bottom">
            {mode === "faithful" && data && manifest ? (
              <NextEvents
                siteData={data}
                period={manifest.period}
                index={index}
                height={height}
              />
            ) : null}
            {mode === "faithful" && data && manifest ? (
              <SkyDescription
                observation={observation}
                siteId={siteId}
                siteName={name(site)}
                height={height}
                index={index}
                period={manifest.period}
                playing={playing}
              />
            ) : null}
            <section className="explorer-prompt">
              <div className="prompt-tabs">
                <button
                  aria-pressed={insight === "time"}
                  onClick={() => setInsight("time")}
                >
                  Try this
                </button>
                <button
                  aria-pressed={insight === "meaning"}
                  onClick={() => setInsight("meaning")}
                >
                  Why it matters
                </button>
              </div>
              {insight === "time" ? (
                <>
                  <h2>Move time. Watch the light change.</h2>
                  <p>
                    Choose Surface sky, then press Play. Can you find a moment
                    when terrain hides the Sun but Earth is visible?
                  </p>
                  <button
                    onClick={() => {
                      setView("sky");
                      setInsight("meaning");
                    }}
                  >
                    Show the surface sky
                  </button>
                </>
              ) : (
                <>
                  <h2>Light and Earth visibility are different.</h2>
                  <p>
                    Sunlight is an energy opportunity. Earth visibility is a
                    line-of-sight opportunity. A useful plan needs to understand
                    both, including the longest gaps.
                  </p>
                  <a href="#/compare">Compare a landing delay →</a>
                </>
              )}
            </section>
            <details className="scene-method">
              <summary>Scene scale, sources and limitations</summary>
              <p>
                NASA LRO/LOLA/LROC via SVS and PGDA. Relief uses true vertical
                scale. The local mesh is an oblique visual overview; the
                separate horizon calculation uses other source resolutions.
              </p>
              <p>
                Body radii and distances use the same physical scale in every
                view. Camera presets change the viewpoint, never body size.
                Surface-sky discs use true radii and distances. Stars are
                catalogue-based with illustrative brightness. Sun glare and the
                thin Earth-atmosphere shading are optical illustrations, not
                ray-traced forecasts. Earth imagery is historical. Clouds are a
                fixed illustrative pattern, not weather for the selected date.
              </p>
              <p>
                Other planets use system barycentre proxies where applicable,
                without Horizons validation. No power budget, radio-link
                guarantee or flight guidance.
              </p>
              <a href="#/evidence">Evidence</a> ·{" "}
              <a href="#/credits">Credits</a>
            </details>
          </div>
        </div>
      </div>
    </main>
  );
}
