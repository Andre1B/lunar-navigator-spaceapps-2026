import { useMemo, useState } from "react";
import { comparisonRows } from "../lib/comparisonReport.mjs";
import { percent } from "../lib/analysis.mjs";

// An immediate, real experiment: exactly the same calculation path as Compare/export.
export default function DelayBriefing({ dataset, onOpen }) {
  const [delay, setDelay] = useState(7);
  const settings = useMemo(
    () => ({
      siteId: "connecting-ridge",
      alternative: "shackleton-rim",
      height: 1,
      date: "2027-03-01",
      days: 7,
      delay,
    }),
    [delay],
  );
  const rows = useMemo(
    () =>
      dataset?.manifest ? comparisonRows(dataset, settings).slice(0, 2) : [],
    [dataset, settings],
  );
  return (
    <section className="delay-briefing" aria-labelledby="briefing-title">
      <div className="briefing-intro">
        <span className="briefing-moon" aria-hidden="true" />
        <div>
          <h2 id="briefing-title">Try a landing delay.</h2>
          <p>One place. Two arrivals. A different view of the Sun.</p>
        </div>
      </div>
      <div
        className="briefing-delays"
        role="group"
        aria-label="Try an arrival delay"
      >
        {[3, 7, 14].map((value) => (
          <button
            key={value}
            aria-pressed={delay === value}
            onClick={() => setDelay(value)}
          >
            +{value} days
          </button>
        ))}
      </div>
      <p className="briefing-context">
        Connecting ridge · 1 m above the ground · a 7-day stay
      </p>
      <div
        className="briefing-results"
        key={delay}
        aria-live="polite"
        aria-atomic="true"
      >
        {rows.length ? (
          rows.map((row, i) => (
            <article key={row.label}>
              <h3>{i ? `Arrive ${delay} days later` : "Arrive on 1 March"}</h3>
              <dl>
                <div>
                  <dt>Longest time without sunlight</dt>
                  <dd>
                    {row.summary
                      ? `${row.summary.dark.censored ? "At least " : ""}${row.summary.dark.hours.toFixed(1)} h`
                      : "Not calculated"}
                  </dd>
                </div>
              </dl>
              <div className="briefing-meter">
                <span>
                  Time with sunlight{" "}
                  <strong>{percent(row.summary?.sunlitFraction)}</strong>
                </span>
                <svg
                  viewBox="0 0 100 5"
                  role="img"
                  aria-label={`Time with sunlight: ${percent(row.summary?.sunlitFraction)}`}
                >
                  <rect width="100" height="5" className="briefing-track" />
                  <rect
                    width={(row.summary?.sunlitFraction ?? 0) * 100}
                    height="5"
                    className="briefing-sun"
                  />
                </svg>
              </div>
              <div className="briefing-meter">
                <span>
                  Time with Earth in view{" "}
                  <strong>{percent(row.summary?.earthFraction)}</strong>
                </span>
                <svg
                  viewBox="0 0 100 5"
                  role="img"
                  aria-label={`Time with Earth in view: ${percent(row.summary?.earthFraction)}`}
                >
                  <rect width="100" height="5" className="briefing-track" />
                  <rect
                    width={(row.summary?.earthFraction ?? 0) * 100}
                    height="5"
                    className="briefing-earth"
                  />
                </svg>
              </div>
            </article>
          ))
        ) : (
          <p>Loading the real lunar comparison…</p>
        )}
      </div>
      <p className="briefing-meaning">
        Same place, different date: the low Sun meets a different part of the
        hills. These are visibility times, not battery life or guaranteed
        communication.
      </p>
      <button
        className="button"
        disabled={!rows.length}
        onClick={() => onOpen(settings)}
      >
        Change the place, date or height →
      </button>
      <p className="briefing-source">
        Computed from NASA LOLA terrain and SPICE positions.{" "}
        <a href="#/evidence">Check the method</a>.
      </p>
    </section>
  );
}
