import { useId, useMemo, useState } from "react";
import {
  glossary,
  intro,
  limits,
  metrics,
  modes,
  raise,
  shadow,
  sources,
  steps,
  toc,
} from "../content/learning.js";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function jump(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({
    behavior: reduced() ? "auto" : "smooth",
    block: "start",
  });
  el.focus({ preventScroll: true });
}

function Module({ id, number, title, intro: text, children }) {
  return (
    <section
      id={id}
      tabIndex={-1}
      className="learn-module"
      aria-labelledby={id + "-title"}
    >
      <p className="section-label">Lesson {number}</p>
      <h2 id={id + "-title"}>{title}</h2>
      <p className="learn-module-intro">{text}</p>
      {children}
    </section>
  );
}

function Details({ summary, children }) {
  return (
    <details className="learn-details">
      <summary>{summary}</summary>
      <div className="learn-details-body">{children}</div>
    </details>
  );
}

/* 1. Raise the observer: a cartoon with made-up distances. */
const W = 400;
const GROUND = 130;
const UNIT = 8; // px per schematic unit
const OBS_X = 40;

function RaiseObserver() {
  const [h, setH] = useState(raise.start);
  const id = useId();
  const { distance, height: ridgeH } = raise.ridge;
  const tan = Math.tan((raise.sunElevation * Math.PI) / 180);
  const visible = h + distance * tan > ridgeH;
  const ridgeX = OBS_X + distance * 4;
  const eyeY = GROUND - h * UNIT;
  const rayEndX = 372;
  const rayEndY = eyeY - (rayEndX - OBS_X) * tan;
  const hitY = eyeY - (ridgeX - OBS_X) * tan;
  const ridgeTop = GROUND - ridgeH * UNIT;
  return (
    <div className="learn-card learn-sim">
      <svg
        className="learn-svg"
        viewBox={`0 0 ${W} 160`}
        role="img"
        aria-label={
          visible
            ? "Cartoon: the observer is high enough, the line to the Sun clears the ridge."
            : "Cartoon: the observer is low, the line to the Sun hits the ridge."
        }
      >
        <rect className="learn-sky" width={W} height={GROUND} />
        <polygon
          className="learn-ground"
          points={`0,${GROUND} ${ridgeX - 50},${GROUND} ${ridgeX},${ridgeTop} ${ridgeX + 50},${GROUND} ${W},${GROUND} ${W},160 0,160`}
        />
        <line
          className={visible ? "learn-ray ok" : "learn-ray blocked"}
          x1={OBS_X}
          y1={eyeY}
          x2={visible ? rayEndX : ridgeX}
          y2={visible ? rayEndY : Math.max(hitY, ridgeTop)}
        />
        {!visible ? (
          <line
            className="learn-ray ghost"
            x1={ridgeX}
            y1={Math.max(hitY, ridgeTop)}
            x2={rayEndX}
            y2={rayEndY}
          />
        ) : null}
        <circle
          className={visible ? "learn-sun on" : "learn-sun off"}
          cx={rayEndX}
          cy={Math.max(rayEndY, 14)}
          r="10"
        />
        <line
          className="learn-pole"
          x1={OBS_X}
          y1={GROUND}
          x2={OBS_X}
          y2={eyeY}
        />
        <circle className="learn-eye" cx={OBS_X} cy={eyeY} r="4" />
        <text
          className="learn-label"
          x={ridgeX}
          y={ridgeTop - 6}
          textAnchor="middle"
        >
          ridge
        </text>
      </svg>
      <label htmlFor={id}>
        Observer height: <strong>{h.toFixed(1)}</strong> units
      </label>
      <input
        id={id}
        type="range"
        min={raise.min}
        max={raise.max}
        step="0.1"
        value={h}
        onChange={(e) => setH(Number(e.target.value))}
        aria-describedby={id + "-result"}
      />
      <p
        id={id + "-result"}
        role="status"
        className={"learn-result " + (visible ? "good" : "bad")}
      >
        {visible ? raise.visible : raise.hidden}
      </p>
      <p className="caption">
        Illustrative cartoon with made-up distances and units. Not a real lunar
        site and not NASA data.
      </p>
    </div>
  );
}

/* 2. Shadow versus no Sun: three quick questions with feedback. */
function ShadowQuiz() {
  const [picked, setPicked] = useState({});
  const answered = Object.keys(picked).length;
  const right = shadow.questions.filter(
    (q) => picked[q.id] !== undefined && q.options[picked[q.id]].right,
  ).length;
  return (
    <div className="learn-quiz">
      {shadow.questions.map((q, qi) => {
        const choice = picked[q.id];
        const done = choice !== undefined;
        return (
          <fieldset key={q.id} className="learn-card learn-question">
            <legend>
              Question {qi + 1} of {shadow.questions.length}
            </legend>
            <p className="learn-scene">{q.scene}</p>
            <p className="learn-ask">{q.ask}</p>
            <div className="learn-options">
              {q.options.map((o, oi) => {
                const state = done
                  ? oi === choice
                    ? o.right
                      ? "chosen right"
                      : "chosen wrong"
                    : o.right
                      ? "reveal"
                      : ""
                  : "";
                return (
                  <button
                    key={o.label}
                    type="button"
                    className={"learn-option " + state}
                    aria-pressed={done && oi === choice}
                    disabled={done}
                    onClick={() => setPicked((p) => ({ ...p, [q.id]: oi }))}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <p
              role="status"
              className={
                "learn-feedback " +
                (done ? (q.options[choice].right ? "good" : "bad") : "")
              }
            >
              {done ? q.options[choice].why : ""}
            </p>
          </fieldset>
        );
      })}
      <div className="learn-score">
        <span className="mono">
          {answered === shadow.questions.length
            ? `You got ${right} of ${shadow.questions.length}.`
            : `${answered} of ${shadow.questions.length} answered.`}
        </span>
        {answered ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => setPicked({})}
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* 3. Faithful versus Free: two pointers on a shared schematic clock. */
function dial(angle) {
  const a = ((angle - 90) * Math.PI) / 180;
  return [50 + 34 * Math.cos(a), 50 + 34 * Math.sin(a)];
}

function ModeDemo() {
  const [mode, setMode] = useState("faithful");
  const [t, setT] = useState(30);
  const [frozenAt, setFrozenAt] = useState(null);
  const id = useId();
  const free = mode === "free";
  const earthT = free && frozenAt !== null ? frozenAt : t;
  const sun = dial(t * 3.6);
  const earth = dial(earthT * 1.4 + 40);
  const mismatch = free && frozenAt !== null && frozenAt !== t;
  const choose = (m) => {
    setMode(m);
    if (m === "faithful") setFrozenAt(null);
  };
  return (
    <div className="learn-card learn-sim">
      <div className="segmented" role="group" aria-label="Demo mode">
        <button
          type="button"
          aria-pressed={!free}
          onClick={() => choose("faithful")}
        >
          {modes.faithful.name}
        </button>
        <button
          type="button"
          aria-pressed={free}
          onClick={() => choose("free")}
        >
          {modes.free.name}
        </button>
      </div>
      <div className="learn-mode-grid">
        <svg
          className="learn-svg learn-dial"
          viewBox="0 0 100 100"
          role="img"
          aria-label={
            mismatch
              ? "Two pointers: the Sun moves with the clock while Earth is stuck at an earlier moment."
              : "Two pointers: the Sun and Earth both follow the same clock."
          }
        >
          <circle className="learn-ring" cx="50" cy="50" r="34" />
          <circle className="learn-sun on" cx={sun[0]} cy={sun[1]} r="6" />
          <circle
            className={"learn-earth " + (mismatch ? "frozen" : "")}
            cx={earth[0]}
            cy={earth[1]}
            r="5"
          />
          <text className="learn-label" x="50" y="53" textAnchor="middle">
            Moon
          </text>
        </svg>
        <div>
          <label htmlFor={id}>
            Shared clock: step <strong>{t}</strong> of 100
          </label>
          <input
            id={id}
            type="range"
            min="0"
            max="100"
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
          />
          {free ? (
            <label className="inline learn-freeze">
              <input
                type="checkbox"
                checked={frozenAt !== null}
                onChange={(e) => setFrozenAt(e.target.checked ? t : null)}
              />
              {modes.freezeLabel}
            </label>
          ) : null}
          <p
            role="status"
            className={"learn-result " + (mismatch ? "warn" : "good")}
          >
            {free
              ? mismatch
                ? "Experimental. Earth is held at an earlier moment while the Sun moved on. This sky never existed, so it gives no mission advice."
                : modes.free.text
              : modes.faithful.text}
          </p>
          <ul className="learn-legend">
            <li>
              <span className="learn-key sun" /> Sun
            </li>
            <li>
              <span className="learn-key earth" /> Earth
            </li>
          </ul>
        </div>
      </div>
      <p className="caption">
        Cartoon dial with invented speeds. It teaches the idea, not the real
        motion of the bodies.
      </p>
    </div>
  );
}

/* 4. Metrics: the same idea measured three ways, computed from teaching data. */
function measure(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sunHours = values.filter((v) => v > 0).length;
  let run = 0;
  let longest = 0;
  for (const v of values) {
    run = v === 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { mean, sunHours, longest };
}

function Metrics() {
  const [caseId, setCaseId] = useState(metrics.cases[0].id);
  const c = metrics.cases.find((x) => x.id === caseId);
  const m = useMemo(() => measure(c.values), [c]);
  const hours = c.values.length;
  return (
    <div className="learn-card learn-sim">
      <div className="segmented" role="group" aria-label="Example place">
        {metrics.cases.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === caseId}
            onClick={() => setCaseId(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <p>{c.blurb}</p>
      <svg
        className="learn-svg"
        viewBox={`0 0 ${hours * 10} 60`}
        role="img"
        aria-label={`Bar chart of ${hours} hours. Each bar shows how much of the Sun is visible that hour.`}
      >
        {c.values.map((v, i) => (
          <rect
            key={i}
            className={v > 0 ? "learn-bar lit" : "learn-bar dark"}
            x={i * 10 + 1}
            y={58 - Math.max(v, 0.04) * 56}
            width="8"
            height={Math.max(v, 0.04) * 56}
          />
        ))}
      </svg>
      <p className="caption">
        Each bar is one hour. Taller means more of the Sun's face is visible.
      </p>
      <dl className="learn-stats">
        <div>
          <dt>{metrics.terms[0][0]}</dt>
          <dd className="mono">{m.mean.toFixed(2)}</dd>
        </div>
        <div>
          <dt>{metrics.terms[1][0]}</dt>
          <dd className="mono">
            {m.sunHours} of {hours} h
          </dd>
        </div>
        <div>
          <dt>{metrics.terms[2][0]}</dt>
          <dd className="mono">{m.longest} h</dd>
        </div>
      </dl>
      <p role="status" className="learn-feedback">
        {caseId === "steady"
          ? "Thin light all day: some Sun every hour and no dark gap, yet a low average."
          : "A similar average hides a very different day: full Sun for a while, then 16 hours with none."}
      </p>
      <ul className="learn-terms">
        {metrics.terms.map(([k, v]) => (
          <li key={k}>
            <strong>{k}.</strong> {v}
          </li>
        ))}
      </ul>
      <p className="caption">{metrics.note}</p>
    </div>
  );
}

/* 5. Stepper: manual, the user decides the pace. */
function Stepper({ onOpen }) {
  const [i, setI] = useState(0);
  const s = steps[i];
  return (
    <div className="learn-card learn-stepper">
      <ol className="learn-dots" aria-label="Steps">
        {steps.map((st, n) => (
          <li key={st.title}>
            <button
              type="button"
              className={n === i ? "active" : n < i ? "seen" : ""}
              aria-current={n === i ? "step" : undefined}
              aria-label={`Step ${n + 1}: ${st.title}`}
              onClick={() => setI(n)}
            >
              {n + 1}
            </button>
          </li>
        ))}
      </ol>
      <div role="group" aria-live="polite" className="learn-step">
        <p className="section-label">
          Step {i + 1} of {steps.length}
        </p>
        <h3>{s.title}</h3>
        <p>{s.body}</p>
        {s.more ? <Details summary="More detail">{s.more}</Details> : null}
        {s.route && onOpen ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => onOpen(s.route)}
          >
            {s.action}
          </button>
        ) : null}
      </div>
      <div className="learn-nav">
        <button
          type="button"
          className="button secondary"
          disabled={i === 0}
          onClick={() => setI(i - 1)}
        >
          Back
        </button>
        <button
          type="button"
          className="button"
          disabled={i === steps.length - 1}
          onClick={() => setI(i + 1)}
        >
          Next step
        </button>
      </div>
    </div>
  );
}


/* Worked example with REAL dataset values (not a cartoon). */
function WorkedExample({ dataset }) {
  const id = "malapert-massif";
  const data = dataset?.sites?.[id];
  const point = dataset?.manifest?.sites?.find((s) => s.id === id);
  const period = dataset?.manifest?.period;
  if (!data?.metrics?.["1"] || !data?.metrics?.["5"] || !point || !period)
    return (
      <p role="status" className="caption">
        The real worked example appears when the documented dataset has loaded.
      </p>
    );
  const m1 = data.metrics["1"],
    m5 = data.metrics["5"];
  const h = (v, c) => (c ? "≥ " : "") + v.toFixed(0) + " h";
  const pc = (v) => (v * 100).toFixed(0) + "%";
  const rows = [
    ["Longest period without direct Sun", h(m1.longestNoDirectSunH, m1.longestNoDirectSunCensored), h(m5.longestNoDirectSunH, m5.longestNoDirectSunCensored)],
    ["Mean visible solar disc", pc(m1.meanSunVisibleFraction), pc(m5.meanSunVisibleFraction)],
    ["Time with any direct Sun", pc(m1.sunlitTimeFraction), pc(m5.sunlitTimeFraction)],
    ["Time with Earth above the terrain horizon", pc(m1.earthVisibleTimeFraction), pc(m5.earthVisibleTimeFraction)],
  ];
  return (
    <div className="learn-worked learn-card">
      <span className="learn-worked-label">Real data · not a cartoon</span>
      <h3>Worked example: {point.name.split(" (")[0]}, 1 m versus 5 m</h3>
      <p>
        Same point ({point.latitudeDeg.toFixed(2)}°, {point.longitudeEastDeg.toFixed(2)}° E), same dates (
        {period.startUtc.slice(0, 10)} to {period.endUtc.slice(0, 10)} UTC). Only the observer height changes.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th scope="col">Whole computed period</th><th scope="col">1 m</th><th scope="col">5 m</th></tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b]) => (
              <tr key={k}><th scope="row">{k}</th><td>{a}</td><td>{b}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>In one sentence:</strong> raising the eyes 4 m lets them look over nearby bumps, so the Sun is hidden for a
        much shorter stretch. Near the pole the Sun stays close to the horizon, so small terrain matters.
      </p>
      <p className="caption">
        Values read at run time from data/sites/{id}.json (metrics on a 5-minute grid; “≥” means the period touches the
        edge of the computed window). Geometry only: not power, battery or communication sizing. The point is from a
        published LOLA study area and is not a selected landing site.
      </p>
    </div>
  );
}

export default function Learn({ onStartTour, onOpen, dataset }) {
  const open = (route) => onOpen && onOpen(route);
  return (
    <main id="main" tabIndex={-1} className="page learn-page">
      <div className="page-heading">
        <p className="section-label">How it works</p>
        <h1>{intro.title}</h1>
        <p className="lead">{intro.lead}</p>
        <div className="learn-cta">
          {onStartTour ? (
            <button type="button" className="button" onClick={onStartTour}>
              Take interactive tour
            </button>
          ) : null}
          <button
            type="button"
            className="button secondary"
            onClick={() => open("simulator")}
          >
            Open simulator
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => open("compare")}
          >
            Compare
          </button>
        </div>
      </div>

      <ul className="learn-facts">
        {intro.facts.map((f) => (
          <li key={f.q} className="learn-card">
            <h2>{f.q}</h2>
            <p>{f.a}</p>
          </li>
        ))}
      </ul>

      <nav className="learn-toc" aria-label="Lessons on this page">
        <span className="caption">Jump to:</span>
        {toc.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="learn-chip"
            onClick={() => jump(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <Module id="raise" number={1} title={raise.title} intro={raise.intro}>
        <RaiseObserver />
        <WorkedExample dataset={dataset} />
        <Details summary="Going deeper">{raise.detail}</Details>
      </Module>

      <Module id="shadow" number={2} title={shadow.title} intro={shadow.intro}>
        <ShadowQuiz />
      </Module>

      <Module id="modes" number={3} title={modes.title} intro={modes.intro}>
        <ModeDemo />
        <Details summary="Going deeper">{modes.detail}</Details>
      </Module>

      <Module
        id="metrics"
        number={4}
        title={metrics.title}
        intro={metrics.intro}
      >
        <Metrics />
        <Details summary="Going deeper">{metrics.detail}</Details>
      </Module>

      <Module
        id="steps"
        number={5}
        title="Use the app in 8 steps"
        intro="Go at your own pace. Move with the buttons or jump to any step. Nothing is required and nothing is saved."
      >
        <Stepper onOpen={onOpen} />
      </Module>

      <Module id="limits" number={6} title={limits.title} intro={limits.intro}>
        <ul className="learn-limits">
          {limits.items.map(([k, v]) => (
            <li key={k} className="learn-card">
              <h3>{k}</h3>
              <p>{v}</p>
            </li>
          ))}
        </ul>
      </Module>

      <Module
        id="sources"
        number={7}
        title={sources.title}
        intro="Every number comes from named public data and open code."
      >
        <ul className="learn-limits">
          {sources.blocks.map((b) => (
            <li key={b.title} className="learn-card">
              <h3>{b.title}</h3>
              <p>{b.text}</p>
            </li>
          ))}
        </ul>
        <p className="caption">{sources.evidence}</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => open("credits")}
        >
          See all credits
        </button>
        <Details summary="Small glossary">
          <dl className="learn-glossary">
            {glossary.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Details>
      </Module>

      <section className="learn-end learn-card" aria-labelledby="learn-end">
        <h2 id="learn-end">Ready to try it?</h2>
        <p>
          You know enough to explore. Start with the tour or go straight in.
        </p>
        <div className="learn-cta">
          {onStartTour ? (
            <button type="button" className="button" onClick={onStartTour}>
              Take interactive tour
            </button>
          ) : null}
          <button
            type="button"
            className="button secondary"
            onClick={() => open("simulator")}
          >
            Open simulator
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => open("compare")}
          >
            Compare
          </button>
        </div>
      </section>
    </main>
  );
}
