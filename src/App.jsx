// AI-assisted implementation and copy: /ai-use.json. No simulated metrics are invented.
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useDataset } from "./lib/useDataset.js";
import {
  chapters,
  sources,
  scientificSoftware,
  researchProjects,
} from "./lib/content.js";
import { percent, hours, timeAt } from "./lib/analysis.mjs";
import ArrivalComparison from "./components/ArrivalComparison.jsx";
import ComparisonAnswer from "./components/ComparisonAnswer.jsx";
import ArrivalSeries from "./components/ArrivalSeries.jsx";
import HomeV2 from "./pages/HomeV2.jsx";
import Review from "./pages/Review.jsx";
import SimulatorV2 from "./pages/SimulatorV2.jsx";
import InteractiveTour from "./components/InteractiveTour.jsx";
import {
  comparisonRows,
  comparisonReport,
  downloadComparison,
  assessDarkness,
} from "./lib/comparisonReport.mjs";
import Learn from "./pages/Learn.jsx";
const links = [
  ["review", "3-min review"],
  ["learn", "How it works"],
  ["mission", "Guided analysis"],
  ["simulator", "Simulator"],
  ["compare", "Compare"],
  ["evidence", "Evidence"],
  ["credits", "Credits"],
];
const routeNow = () => location.hash.slice(2).split("?")[0] || "home";
const go = (route) => {
  location.hash = "/" + route;
};
function Button({ children, onClick, secondary = false, ...props }) {
  return (
    <button
      className={secondary ? "button secondary" : "button"}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
function Header({ route, mode, onTour }) {
  return (
    <header className="header">
      <a className="brand" href="#/home">
        <img src="/icon.svg" width="29" height="29" alt="" />
        LUNAR NAVIGATOR
      </a>
      <nav aria-label="Main navigation">
        {links.map(([id, label]) => (
          <a
            key={id}
            href={"#/" + id}
            aria-current={route === id ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <button className="header-tour" data-tour-start onClick={onTour}>
        Take a tour
      </button>
    </header>
  );
}
function DataStatus({ dataset }) {
  if (dataset.status === "ready") return null;
  return (
    <aside className="data-status" role="status">
      {dataset.status === "loading"
        ? "Loading the documented scientific dataset…"
        : "Scientific dataset is not available yet. Exploration instructions remain accessible; numerical results are not shown."}
      {dataset.error ? (
        <details>
          <summary>Technical details</summary>
          {dataset.error}
        </details>
      ) : null}
    </aside>
  );
}
function Mission({ chapter, setChapter, mode, journal, setJournal }) {
  const c = chapters[chapter];
  return (
    <main id="main" tabIndex={-1} className="page mission-page">
      <div className="page-heading">
        <p className="section-label">
          Guided analysis · {mode === "faithful" ? "Faithful" : "Free"} Mode
        </p>
        <h1>{c.title}</h1>
        <p className="lead">{c.body}</p>
      </div>
      <div className="mission-layout">
        <ol className="chapter-list" aria-label="Analysis steps">
          {chapters.map((x, i) => (
            <li key={x.title}>
              <button
                aria-current={chapter === i ? "step" : undefined}
                onClick={() => setChapter(i)}
              >
                <span className="mono">0{i + 1}</span>
                <span>
                  {x.title}
                  <small>{x.minutes}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <section className="mission-task">
          <span className="section-label">Your investigation</span>
          <h2>{c.question}</h2>
          <p>
            Open the tool, experiment and return here whenever you want. Every
            chapter is available from the beginning.
          </p>
          <Button onClick={() => go(c.route)}>{c.action}</Button>
          <div className="mission-journal">
            <label htmlFor="mission-note">Analysis notes</label>
            <textarea
              id="mission-note"
              rows="3"
              maxLength={1000}
              placeholder="Write a prediction, a trade-off or an observation..."
              value={journal[chapter]?.note ?? ""}
              onChange={(e) =>
                setJournal((j) => ({
                  ...j,
                  [chapter]: { ...j[chapter], note: e.target.value },
                }))
              }
            />
            <label className="inline">
              <input
                type="checkbox"
                checked={!!journal[chapter]?.explored}
                onChange={(e) =>
                  setJournal((j) => ({
                    ...j,
                    [chapter]: { ...j[chapter], explored: e.target.checked },
                  }))
                }
              />
              I explored this question
            </label>
            <p className="caption">
              Notes remain in this browser session while you change screens.
              They are not sent to a server.
            </p>
          </div>
          <div className="between chapter-controls">
            <Button
              secondary
              disabled={!chapter}
              onClick={() => setChapter((v) => v - 1)}
            >
              Previous chapter
            </Button>
            <Button
              secondary
              onClick={() =>
                chapter < 4 ? setChapter((v) => v + 1) : go("compare")
              }
            >
              {chapter < 4 ? "Next chapter" : "Review your decision"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
function Setup({
  manifest,
  siteId,
  setSiteId,
  height,
  setHeight,
  date,
  setDate,
  days,
  setDays,
  delay,
  setDelay,
  alternative,
  setAlternative,
}) {
  return (
    <aside className="setup">
      <h2>1. Set up your comparison</h2>
      <p className="caption">
        Results update as you change a setting. These are study points, not
        certified landing sites.
      </p>
      <label htmlFor="site">Lunar location</label>
      <select
        id="site"
        value={siteId}
        onChange={(e) => setSiteId(e.target.value)}
      >
        {manifest.sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name.split(" (")[0]}
          </option>
        ))}
      </select>
      <label htmlFor="height">Observer height above terrain</label>
      <select
        id="height"
        value={height}
        onChange={(e) => setHeight(Number(e.target.value))}
      >
        {manifest.observerHeightsM.map((h) => (
          <option key={h} value={h}>
            {h} m
          </option>
        ))}
      </select>
      <p className="height-explainer">
        Height of your eyes, camera or antenna above the ground.
        {height < 1
          ? " At 0.5 m, unresolved ground detail can strongly affect the answer."
          : ""}
      </p>
      <label htmlFor="arrival">Arrival date · UTC</label>
      <input
        id="arrival"
        type="date"
        min={manifest.period.startUtc.slice(0, 10)}
        max={manifest.period.endUtc.slice(0, 10)}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <label htmlFor="days">Length of stay</label>
      <select
        id="days"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        {[3, 7, 14, 28].map((d) => (
          <option key={d} value={d}>
            {d} days
          </option>
        ))}
      </select>
      <label htmlFor="delay">Arrival delay</label>
      <select
        id="delay"
        data-tour="arrival-delay"
        value={delay}
        onChange={(e) => setDelay(Number(e.target.value))}
      >
        {[1, 3, 7, 14, 29].map((d) => (
          <option key={d} value={d}>
            +{d} {d === 1 ? "day" : "days"}
          </option>
        ))}
      </select>
      <label htmlFor="alternative">Alternative place · delayed date</label>
      <select
        id="alternative"
        value={alternative}
        onChange={(e) => setAlternative(e.target.value)}
      >
        {manifest.sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name.split(" (")[0]}
          </option>
        ))}
      </select>
      <p className="caption">
        Supported period: {manifest.period.startUtc.slice(0, 10)} –{" "}
        {manifest.period.endUtc.slice(0, 10)}. Windows beyond coverage are not
        calculated.
      </p>
    </aside>
  );
}
function Compare({
  dataset,
  settings,
  setters,
  setIndex,
  mode,
  tourActive = false,
  onInspect,
}) {
  const { manifest, sites } = dataset;
  const [limit, setLimit] = useState(72);
  const rows = useMemo(
    () => comparisonRows(dataset, settings),
    [dataset, settings],
  );
  const ephemerisProduct = manifest?.provenance.kernels.find((k) =>
    k.file.startsWith("de440"),
  )?.file;
  return (
    <main id="main" tabIndex={-1} className="page">
      <div className="page-heading">
        <h1>What does a landing delay change?</h1>
        <p className="lead">
          Keep the same length of stay. Compare your original arrival, a later
          arrival at the same place, and a different place on the delayed date.
        </p>
      </div>
      <DataStatus dataset={dataset} />
      {manifest ? (
        <div className="compare-layout">
          <Setup manifest={manifest} {...settings} {...setters} />
          <div className="comparison-content">
            <ComparisonAnswer
              rows={rows}
              manifest={manifest}
              settings={settings}
              onInspect={onInspect}
            />
            {mode === "free" ? (
              <aside className="warning">
                <strong>You are exploring in Free Mode.</strong> The table below
                remains a separate Faithful Mode reference. Artificial freezes
                never change these results.
              </aside>
            ) : null}
            <details
              className="comparison-details"
              open={tourActive || undefined}
            >
              <summary>Full measurements, methods and a darkness limit</summary>
              <p>
                Optional detail. The three results above already answer the
                basic comparison. Open this section to check all four
                measurements, save a JSON record or test your own limit.
              </p>
              <section>
                <div className="section-heading">
                  <h2>2. Check the detailed measurements</h2>
                  <button
                    onClick={() =>
                      downloadComparison(
                        comparisonReport(dataset, settings, limit),
                      )
                    }
                  >
                    Download comparison · JSON
                  </button>
                </div>
                <p className="caption">
                  A local, reproducible record of these settings, results,
                  source hashes and limitations. Nothing is uploaded.
                </p>
                <div className="table-wrap" data-tour="scenario-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Scenario</th>
                        <th>
                          Average Sun disc in view{" "}
                          <span className="metric-product">
                            {ephemerisProduct} + LOLA
                          </span>
                          <a
                            className="metric-method"
                            href="#/evidence?metric=solar"
                            aria-label="Mean visible Sun: data and method"
                          >
                            Method ↗
                          </a>
                        </th>
                        <th>
                          Longest time without Sun{" "}
                          <span className="metric-product">
                            {ephemerisProduct} + LOLA
                          </span>
                          <a
                            className="metric-method"
                            href="#/evidence?metric=darkness"
                            aria-label="Longest darkness: data and method"
                          >
                            Method ↗
                          </a>
                        </th>
                        <th>
                          Earth visible{" "}
                          <span className="metric-product">
                            {ephemerisProduct} + LOLA
                          </span>
                          <a
                            className="metric-method"
                            href="#/evidence?metric=earth"
                            aria-label="Earth visibility: data and method"
                          >
                            Method ↗
                          </a>
                        </th>
                        <th>
                          Longest time without Earth{" "}
                          <span className="metric-product">
                            {ephemerisProduct} + LOLA
                          </span>
                          <a
                            className="metric-method"
                            href="#/evidence?metric=earth-gap"
                            aria-label="Longest Earth gap: data and method"
                          >
                            Method ↗
                          </a>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.label}>
                          <th scope="row">
                            {r.label}
                            <small>
                              {manifest.sites.find((s) => s.id === r.id)?.name}{" "}
                              · {settings.date}
                              {r.offset ? " + " + r.offset + " days" : ""}
                            </small>
                          </th>
                          <td>{percent(r.summary?.meanSun)}</td>
                          <td>{hours(r.summary?.dark)}</td>
                          <td>{percent(r.summary?.earthFraction)}</td>
                          <td>{hours(r.summary?.noEarth)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="caption">
                  “Average Sun disc” measures how much of the Sun's face is
                  visible on average, including partial sunrises. It differs
                  from “time with some sunlight” above. Faithful calculations at{" "}
                  {settings.height} m · {settings.days}
                  -day windows. “≥” means the interval touches a window
                  boundary. Mean visible Sun: hourly approximation. Durations:
                  5-minute event search, boundaries refined to at most 1 minute;
                  shorter gaps may be missed.
                </p>
              </section>
              <section className="decision" data-tour="example-constraint">
                <label htmlFor="dark-limit">
                  Example constraint: maximum continuous darkness
                </label>
                <div className="inline">
                  <input
                    id="dark-limit"
                    type="number"
                    min="0"
                    max="1000"
                    value={limit}
                    onChange={(e) => {
                      const value = e.target.valueAsNumber;
                      setLimit(
                        Number.isFinite(value)
                          ? Math.min(1000, Math.max(0, value))
                          : 0,
                      );
                    }}
                  />
                  <span>hours · user-defined, not a NASA requirement</span>
                </div>
                <div className="constraint-results" aria-live="polite">
                  {rows.map((r) => {
                    const assessment = assessDarkness(r.summary, limit);
                    const scale =
                      Math.max(limit, r.summary?.dark.hours ?? 0, 1) * 1.12;
                    return (
                      <article
                        className={"constraint-result " + assessment.status}
                        key={r.label}
                      >
                        <h3>{r.label}</h3>
                        {r.summary ? (
                          <>
                            <p>
                              <strong>
                                {r.summary.dark.censored ? "≥ " : ""}
                                {r.summary.dark.hours.toFixed(1)} h darkness
                              </strong>
                              <span> · your limit {limit} h</span>
                            </p>
                            <svg
                              viewBox="0 0 280 30"
                              role="img"
                              aria-label={`Observed darkness ${r.summary.dark.censored ? "at least " : ""}${r.summary.dark.hours.toFixed(1)} hours; example limit ${limit} hours.`}
                            >
                              <rect
                                className="constraint-track"
                                x="0"
                                y="10"
                                width="280"
                                height="10"
                              />
                              <rect
                                className="constraint-fill"
                                x="0"
                                y="10"
                                width={(280 * r.summary.dark.hours) / scale}
                                height="10"
                              />
                              <line
                                className="constraint-marker"
                                x1={(280 * limit) / scale}
                                x2={(280 * limit) / scale}
                                y1="3"
                                y2="27"
                              />
                              {r.summary.dark.censored ? (
                                <path
                                  className="constraint-open"
                                  d={`M ${(280 * r.summary.dark.hours) / scale - 5} 5 l 8 10 l -8 10`}
                                />
                              ) : null}
                            </svg>
                          </>
                        ) : null}
                        <p>{assessment.message}</p>
                      </article>
                    );
                  })}
                </div>
                <p className="caption">
                  Darkness alone does not determine battery survival. Earth
                  visibility does not guarantee an operational link. Evaluate
                  the trade-offs rather than a universal “best site”.
                </p>
              </section>
            </details>
            <ArrivalComparison
              rows={rows}
              sites={sites}
              period={manifest.period}
              height={settings.height}
              onInspect={(i) => {
                onInspect({ id: settings.siteId, bounds: { start: i } });
              }}
            />
            <details className="comparison-details">
              <summary>Compare every possible arrival date</summary>
              <ArrivalSeries
                siteData={sites[settings.siteId]}
                siteName={
                  manifest.sites.find((s) => s.id === settings.siteId)?.name
                }
                period={manifest.period}
                height={Number(settings.height)}
                days={Number(settings.days)}
                selectedDate={settings.date}
                onSelect={setters.setDate}
              />
            </details>
          </div>
        </div>
      ) : null}
    </main>
  );
}
function Evidence({ dataset }) {
  const { manifest, validation } = dataset;
  const control = validation?.tests.find((t) => t.id === "V5");
  const shadowPixel = Array.isArray(control?.result)
    ? control.result.find((r) => r.psrPixel)?.psrPixel
    : null;
  const readMetric = () =>
    new URLSearchParams(location.hash.split("?")[1] ?? "").get("metric");
  const [metric, setMetric] = useState(readMetric);
  useEffect(() => {
    const change = () => setMetric(readMetric());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const methods = {
    solar: [
      "Mean visible Sun",
      "The time average of the visible solar-disc fraction above the terrain horizon. Computed by trapezoidal integration of hourly samples. Not sunlight hours, electrical power or a battery model.",
    ],
    darkness: [
      "Longest darkness",
      "The longest interval with no part of the Sun above the terrain horizon. A five-minute event search is refined to at most one minute; shorter events can be missed. An interval touching a window edge is a lower bound (≥), never a complete duration claim.",
    ],
    earth: [
      "Earth visible",
      "The fraction of the operating window with any part of Earth above the terrain horizon, using refined rise/set events. This optimistic geometric criterion does not guarantee a radio link, antenna pointing, DSN availability or weather conditions on Earth.",
    ],
    "earth-gap": [
      "Longest Earth gap",
      "The longest interval with no part of Earth above the terrain horizon. The same event resolution and censored-window rules apply as for darkness. It does not include relay satellites or link budgets.",
    ],
  };
  return (
    <main id="main" tabIndex={-1} className="page prose">
      <h1>Show your work.</h1>
      <p className="lead">
        A decision should come with a trail someone else can follow.
      </p>
      {methods[metric] ? (
        <section className="metric-explanation">
          <h2>{methods[metric][0]} · method</h2>
          <p>{methods[metric][1]}</p>
          <p>
            <a href="/data/manifest.json">
              Dataset, coordinates & source hashes ↗
            </a>
            {" · "}
            <a href="/data/integrity.json">Derived-file checksums ↗</a>
          </p>
          <a href="#/compare">Return to your comparison →</a>
        </section>
      ) : null}
      <section>
        <h2>What the model does</h2>
        <p>
          For a documented point and time, astronomical positions determine the
          direction and apparent size of the Sun and Earth. A horizon derived
          from lunar elevation data determines which part of each disc is
          visible. The comparison summarizes those fractions over the selected
          operating window.
        </p>
        <p>
          The globe is an explanatory view. Numerical terrain visibility comes
          from the published elevation products, not the appearance of the globe
          texture.
        </p>
      </section>
      <DataStatus dataset={dataset} />
      <section>
        <h2>Validation status</h2>
        <p className="caption">
          Scientific validation record generated:{" "}
          {validation?.generatedAtUtc ?? "pending"}. This date identifies the
          data checks, not a browser or performance audit.
        </p>
        {validation?.tests?.length ? (
          <div className="validation-list" data-tour="validation">
            {validation.tests.map((t) => (
              <article key={t.id}>
                <span className={"test-status " + t.status}>{t.status}</span>
                <h3>{t.title}</h3>
                <p>{t.method}</p>
                <p className="mono">
                  Target:{" "}
                  {typeof t.target === "object"
                    ? JSON.stringify(t.target)
                    : t.target}{" "}
                  · Result:{" "}
                  {t.result === null
                    ? "Pending"
                    : typeof t.result === "object"
                      ? JSON.stringify(t.result)
                      : String(t.result)}
                </p>
                <details>
                  <summary>Evidence & notes</summary>
                  <pre>
                    {JSON.stringify(
                      { evidence: t.evidence, notes: t.notes },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </article>
            ))}
          </div>
        ) : (
          <p>
            No completed validation is asserted while the dataset is being
            prepared.
          </p>
        )}
      </section>
      {shadowPixel ? (
        <section className="negative-control">
          <h2>A check that should stay dark.</h2>
          <p>
            We selected one pixel classified as permanently shadowed in a
            published LOLA map. Across the 2024–2026 reference interval, its
            largest computed visible Sun fraction was{" "}
            <strong>{percent(shadowPixel.maxSunFraction2024to2026)}</strong>.
          </p>
          <p>
            This is a negative control: a misplaced Sun or terrain horizon could
            wrongly light a point that should remain dark. It checks this
            reference pixel, not the whole crater and not every possible
            location.
          </p>
          <p className="caption">
            V5 status: {control.status}. Reference coordinate:{" "}
            {shadowPixel.latDeg}° latitude, {shadowPixel.lonEastDeg}° east
            longitude. Source: LOLA permanently shadowed-region map; exact
            record in validation.json.
          </p>
        </section>
      ) : null}
      <section>
        <h2>What this does not establish</h2>
        <ul>
          <li>
            Direct Earth visibility is geometry, not antenna gain, link budget,
            DSN scheduling or relay coverage.
          </li>
          <li>
            Sunlight is not electrical power or a battery survival prediction.
          </li>
          <li>
            Points of interest are not certified or selected landing sites.
          </li>
          <li>
            Mean illumination uses hourly samples. Duration events are searched
            at 5-minute intervals and refined to at most 1 minute; shorter
            events can still be missed.
          </li>
          <li>
            Free Mode is deliberately artificial. Its configurations cannot be
            used as real mission dates.
          </li>
        </ul>
        {manifest?.limitations?.map((x, i) => (
          <p key={i}>{x}</p>
        ))}
      </section>
      <section>
        <h2>Source data & resources</h2>
        {sources.map((s) => (
          <article className="source" key={s.title}>
            <h3>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title} ↗
              </a>
            </h3>
            <p>{s.use}</p>
          </article>
        ))}
      </section>
      {manifest ? (
        <details>
          <summary>Dataset conventions, assumptions and provenance</summary>
          <pre>
            {JSON.stringify(
              {
                period: manifest.period,
                conventions: manifest.conventions,
                assumptions: manifest.assumptions,
                provenance: manifest.provenance,
              },
              null,
              2,
            )}
          </pre>
          <a href="/data/manifest.json">Open dataset manifest</a>
        </details>
      ) : null}
      <p>
        <a href="/summary.html">Project summary</a> ·{" "}
        <a href="/summary.txt">Plain-text summary</a> ·{" "}
        <a href="/ai-use.json">AI assistance record</a>
      </p>
    </main>
  );
}
function Credits() {
  const [credits, setCredits] = useState(null);
  useEffect(() => {
    let live = true;
    fetch("/credits.json")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((x) => {
        if (live) setCredits(x);
      })
      .catch(() => {
        if (live) setCredits({ packages: [] });
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <main id="main" tabIndex={-1} className="page prose">
      <h1>Built with open knowledge.</h1>
      <p className="lead">
        The sources, software and people behind the exploration.
      </p>
      <section>
        <h2>Our original work</h2>
        <p>
          Team An0r4k’s NASA Space Apps 2026 prototype combines the
          human-directed guided and open workflows, a faithful/experimental
          simulation interface, documented terrain visibility calculations and a
          public evidence trail. The original code is Apache-2.0; third-party
          materials retain their own terms.
        </p>
        <a
          className="button"
          href="https://github.com/Andre1B/lunar-navigator-spaceapps-2026"
          target="_blank"
          rel="noreferrer"
        >
          Open the project on GitHub ↗
        </a>
      </section>
      <section>
        <h2>Software used</h2>
        <p>
          Direct and transitive dependencies, including build and verification
          tools. Project links identify their maintainers; no affiliation or
          endorsement is implied.
        </p>
        {credits ? (
          <div className="credit-list">
            {[...scientificSoftware, ...credits.packages].map((p) => (
              <article key={p.name + "@" + p.version}>
                <h3>
                  {p.name} <small>{p.version}</small>
                </h3>
                <p>
                  {p.license}
                  {p.role ? (
                    <>
                      <br />
                      {p.role}
                    </>
                  ) : null}
                </p>
                <a
                  href={p.repository || p.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.repository?.includes("github.com")
                    ? "GitHub repository"
                    : "Project source"}{" "}
                  ↗
                </a>
                {p.noticeFile ? (
                  <a href={p.noticeFile}>License notice</a>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p>Loading dependency credits…</p>
        )}
      </section>
      <section>
        <h2>Data and scientific references</h2>
        <p>
          NASA JPL / NAIF; LRO / LOLA; NASA Goddard PGDA; LROC instrument teams.
          Moon appearance: NASA’s Scientific Visualization Studio, Ernie Wright
          (STC), Noah Petro (NASA/GSFC). Detailed products, papers and kernel
          versions accompany the dataset.
        </p>
        <a href="#/evidence">Open the source trail →</a>
      </section>
      <section>
        <h2>Prior projects studied</h2>
        <p>
          Research references and inspiration, not reused application code or
          assets. Their reported performance was not independently reproduced.
        </p>
        <ul>
          {researchProjects.map(([name, url, use]) => (
            <li key={name}>
              <a href={url} target="_blank" rel="noreferrer">
                {name}
              </a>{" "}
              - {use}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>AI assistance</h2>
        <p>
          Claude and Codex assisted with research, implementation, explanatory
          text, testing and documentation. Astronomical samples are computed
          from the cited data and algorithms, not predicted by a language model.
          Read the record for implementation and validation limits.
        </p>
        <a href="/ai-use.json">AI use metadata</a>
      </section>
      <p>
        Independent educational prototype. NASA and partner names describe
        sources and the challenge; they do not certify or endorse this project.
      </p>
    </main>
  );
}
export default function App() {
  const dataset = useDataset();
  const [route, setRoute] = useState(routeNow),
    [mode, setMode] = useState("faithful"),
    [chapter, setChapter] = useState(0),
    // A documented study epoch, shown explicitly in UTC; not the user's clock.
    [index, setIndex] = useState(12),
    [journal, setJournal] = useState({}),
    [tourStep, setTourStep] = useState(null);
  const tourOrigin = useRef(null);
  const startTour = () => {
    tourOrigin.current = document.activeElement;
    setTourStep(0);
  };
  const closeTour = () => {
    setTourStep(null);
    requestAnimationFrame(() => {
      const t = tourOrigin.current?.isConnected
        ? tourOrigin.current
        : document.querySelector("[data-tour-start]");
      t?.focus();
    });
  };
  const [siteId, setSiteId] = useState(""),
    [inspectedSiteId, setInspectedSiteId] = useState(null),
    [inspectedHeight, setInspectedHeight] = useState(1),
    [alternative, setAlternative] = useState(""),
    [height, setHeight] = useState(1),
    [date, setDate] = useState("2027-03-01"),
    [days, setDays] = useState(7),
    [delay, setDelay] = useState(7);
  useEffect(() => {
    const change = () => {
      const next = routeNow();
      setRoute(next);
      if (next !== "simulator") setInspectedSiteId(null);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (dataset.manifest) {
      setSiteId(dataset.manifest.sites[0].id);
      setAlternative(
        dataset.manifest.sites[1]?.id ?? dataset.manifest.sites[0].id,
      );
      setDate(dataset.manifest.period.startUtc.slice(0, 10));
    }
  }, [dataset.manifest]);
  const settings = { siteId, alternative, height, date, days, delay },
    setters = {
      setSiteId,
      setAlternative,
      setHeight,
      setDate,
      setDays,
      setDelay,
    };
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <Header route={route} mode={mode} onTour={startTour} />
      {route === "home" ? (
        <HomeV2
          onTour={startTour}
          onStart={(m) => {
            setMode(m);
            setChapter(0);
            go("simulator");
          }}
        />
      ) : route === "review" ? (
        <Suspense
          fallback={
            <main id="main" tabIndex={-1} className="page">
              <h1>Loading the short review…</h1>
            </main>
          }
        >
          <Review dataset={dataset} settings={settings} />
        </Suspense>
      ) : route === "learn" ? (
        <Suspense
          fallback={
            <main id="main" className="page">
              <h1>Loading the interactive guide...</h1>
            </main>
          }
        >
          <Learn onStartTour={startTour} onOpen={go} dataset={dataset} />
        </Suspense>
      ) : route === "mission" ? (
        <Mission
          chapter={chapter}
          setChapter={setChapter}
          mode={mode}
          journal={journal}
          setJournal={setJournal}
        />
      ) : route === "simulator" ? (
        <SimulatorV2
          tourActive={tourStep !== null}
          onTour={startTour}
          dataset={dataset}
          index={index}
          setIndex={setIndex}
          mode={mode}
          setMode={setMode}
          siteId={inspectedSiteId ?? siteId}
          inspecting={inspectedSiteId !== null}
          setSiteId={inspectedSiteId === null ? setSiteId : setInspectedSiteId}
          height={inspectedSiteId === null ? height : inspectedHeight}
          setHeight={inspectedSiteId === null ? setHeight : setInspectedHeight}
        />
      ) : route === "compare" ? (
        <Compare
          onInspect={(row) => {
            setInspectedSiteId(row.id);
            setInspectedHeight(height);
            setIndex(row.bounds.start);
            setMode("faithful");
            go("simulator");
          }}
          tourActive={tourStep !== null}
          dataset={dataset}
          settings={settings}
          setters={setters}
          index={Math.round(index)}
          setIndex={setIndex}
          mode={mode}
        />
      ) : route === "evidence" ? (
        <Evidence dataset={dataset} />
      ) : route === "credits" ? (
        <Credits />
      ) : (
        <main id="main" tabIndex={-1} className="page">
          <h1>This route is not available.</h1>
          <a href="#/home">Return home</a>
        </main>
      )}
      {tourStep !== null ? (
        <InteractiveTour
          index={tourStep}
          onChange={setTourStep}
          onClose={closeTour}
          onNavigate={go}
        />
      ) : null}
      <footer className="footer">
        <a
          className="event-mark"
          href="https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/"
        >
          <img
            src="/assets/space-apps-official-white.png"
            width="180"
            height="65"
            alt="NASA International Space Apps Challenge"
          />
        </a>
        <a href="#/home">Lunar Navigator</a>
        <span>NASA Space Apps 2026 · Team An0r4k</span>
        <a href="#/credits">Sources, credits & open source</a>
        <a href="/summary.html">About the project</a>
      </footer>
    </>
  );
}
