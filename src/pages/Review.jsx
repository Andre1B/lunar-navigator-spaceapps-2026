import { useMemo } from "react";
import { comparisonRows } from "../lib/comparisonReport.mjs";
import { percent, hours } from "../lib/analysis.mjs";

export default function Review({ dataset, settings }) {
  const rows = useMemo(
    () => comparisonRows(dataset, settings),
    [dataset, settings],
  );
  const v1 = dataset.validation?.tests.find((t) => t.id === "V1");
  return (
    <main id="main" tabIndex={-1} className="page review-page">
      <p className="section-label">Review in three minutes</p>
      <h1>
        If a Moon landing is delayed,
        <br />
        how does sunlight change?
      </h1>
      <p className="lead">
        This tool compares how long a lunar place can see the Sun and Earth.
        Choose a place, arrival date and observer height. Compare the original
        arrival, a delay and another place; use the 3D simulator to see why.
      </p>
      <nav className="review-jumps" aria-label="Review steps">
        <a href="#/simulator">Inspect the simulator</a>
        <a href="#/compare">Change the scenario</a>
        <a href="#/evidence">Audit the evidence</a>
        <a href="/demo/">Six-slide demo</a>
      </nav>
      <div className="review-layout">
        <section>
          <p className="section-label">30 seconds · the question</p>
          <h2>Terrain and time decide what you can see.</h2>
          <p>
            Choose one of four points within published LOLA polar study regions
            and an observer height of 0.5, 1, 2, 5 or 10 metres. Two points are
            published region centroids; we selected the other two from the
            published illumination map. Their exact coordinates and selection
            methods are public.
          </p>
          <p>
            Move one astronomical clock in Faithful Mode, inspect the terrain
            horizon, then compare a delay and an alternative point.
          </p>
          <p>
            The 3D model preserves physical body sizes and distances. Camera
            presets change the viewpoint. Free Mode is a separate, explicitly
            artificial experiment.
          </p>
          <a href="#/learn">See how the model works →</a>
        </section>
        <section>
          <p className="section-label">90 seconds · the experiment</p>
          <h2>Same assumptions. Three consequences.</h2>
          <p>
            {settings.date} arrival · {settings.days}-day operation ·{" "}
            {settings.height} m observer · +{settings.delay} days delay. These
            are your current comparison settings.
          </p>
          <div className="review-results">
            {rows.length ? (
              rows.map((r) => (
                <article key={r.label}>
                  <h3>{r.label}</h3>
                  <p>
                    {dataset.manifest.sites.find((s) => s.id === r.id)?.name}
                  </p>
                  <dl>
                    <div>
                      <dt>Time with some sunlight</dt>
                      <dd>{percent(r.summary?.sunlitFraction)}</dd>
                    </div>
                    <div>
                      <dt>Longest time without Sun</dt>
                      <dd>{hours(r.summary?.dark)}</dd>
                    </div>
                    <div>
                      <dt>Earth visible</dt>
                      <dd>{percent(r.summary?.earthFraction)}</dd>
                    </div>
                  </dl>
                </article>
              ))
            ) : (
              <p role="status">Loading the documented dataset…</p>
            )}
          </div>
          <p className="caption">
            The percentages describe the share of your stay. A ≥ value means the
            period continues beyond your window, so its full length may be
            longer. Duration events use a 5-minute search refined to at most 1
            minute. Shorter events can be missed.
          </p>
          <a className="button" href="#/compare">
            Change the inputs & download the result
          </a>
        </section>
        <section className="review-evidence">
          <p className="section-label">60 seconds · the evidence</p>
          <h2>How we know.</h2>
          <div className="review-proof">
            <div>
              <strong>{v1?.result?.n ?? "—"}</strong>
              <span>sampled directions compared with JPL Horizons</span>
              <small>
                V1 status: {v1?.status ?? "pending"}. Agreement limited to
                sampled instants and printed precision.
              </small>
            </div>
            <div>
              <strong>
                {dataset.sites[settings.siteId]?.horizon?.elevationDeg?.["1"]
                  ?.length ?? "—"}
              </strong>
              <span>terrain-horizon directions at each height</span>
              <small>
                Nested LOLA elevation models. Physical, local terrain
                visibility.
              </small>
            </div>
            <div>
              <strong>
                {dataset.manifest?.observerHeightsM.length ?? "—"}
              </strong>
              <span>observer heights, with executed sensitivity checks</span>
              <small>
                See V2–V5, including the exploratory-target caveat in V2.
              </small>
            </div>
          </div>
          <p>
            Published NASA elevation data and NAIF SPICE ephemerides are
            processed offline. The public repository contains the generator,
            source hashes, conventions, limitations and independent tests.
          </p>
          <a href="#/evidence">Read the executed validation →</a>
          {" · "}
          <a
            href="https://github.com/Andre1B/lunar-navigator-spaceapps-2026"
            target="_blank"
            rel="noopener noreferrer"
          >
            Inspect the source code ↗
          </a>
        </section>
        <aside className="review-limits">
          <h2>What this establishes</h2>
          <p>
            A documented comparison of geometric sunlight and Earth visibility.
            It does not establish battery survival, a radio link, landing safety
            or flight guidance.
          </p>
          <p>
            Original code is Apache-2.0; data and third-party assets retain
            their own terms. AI assistance and the unresolved interpretation of
            earlier AI-assisted ideation are disclosed.
          </p>
          <a href="#/credits">Sources, licences & AI disclosure →</a>
        </aside>
      </div>
    </main>
  );
}
