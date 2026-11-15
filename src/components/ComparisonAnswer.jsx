import { formatDelay, percent, timeAt } from "../lib/analysis.mjs";

function duration(interval) {
  if (!interval) return "Not calculated";
  const days = interval.hours / 24;
  return `${interval.censored ? "At least " : ""}${interval.hours.toFixed(1)} hours${days >= 1 ? ` (${days.toFixed(1)} days)` : ""}`;
}

// Explanations use the SAME summaries as the detailed table and export.
// An edge-truncated interval cannot establish the direction of a change.
export default function ComparisonAnswer({
  rows,
  manifest,
  settings,
  onInspect,
}) {
  const original = rows[0]?.summary?.dark,
    delayed = rows[1]?.summary?.dark;
  let explanation = "Choose a valid arrival date to see what a delay changes.";
  if (original && delayed) {
    if (original.censored || delayed.censored) {
      explanation =
        "A dark period reaches the edge of your selected stay. “At least” is a minimum, not the full length. Try a longer stay to see more of it.";
    } else {
      const difference = delayed.hours - original.hours;
      explanation =
        Math.abs(difference) < 0.05
          ? `A delay of ${formatDelay(settings.delay)} leaves the longest stretch without sunlight unchanged in these windows.`
          : `A delay of ${formatDelay(settings.delay)} makes the longest stretch without sunlight ${Math.abs(difference).toFixed(1)} hours ${difference > 0 ? "longer" : "shorter"} at the same place.`;
    }
  }
  return (
    <section
      className="comparison-answer"
      data-tour="comparison-answer"
      aria-labelledby="answer-title"
    >
      <h2 id="answer-title">Here is what changes.</h2>
      <p className="answer-explanation">{explanation}</p>
      <div className="answer-scenarios">
        {rows.map((row, i) => {
          const point = manifest.sites.find((s) => s.id === row.id);
          return (
            <article key={row.label} className="answer-scenario">
              <h3>
                <span className="answer-letter" aria-hidden="true">
                  {"ABC"[i]}
                </span>
                {row.label}
                {i ? (
                  <small>
                    {i === 1
                      ? ` · same place, +${formatDelay(settings.delay)}`
                      : ` · another place, same delayed date`}
                  </small>
                ) : (
                  <small> · your plan</small>
                )}
              </h3>
              <dl className="answer-context">
                <div>
                  <dt>Place</dt>
                  <dd>{point?.name.split(" (")[0]}</dd>
                </div>
                <div>
                  <dt>Arrival (UTC)</dt>
                  <dd>
                    {row.bounds
                      ? timeAt(manifest.period, row.bounds.start)
                          .slice(0, 16)
                          .replace("T", " ")
                      : "Outside the calculated period"}
                  </dd>
                </div>
                <div>
                  <dt>Stay · observer height</dt>
                  <dd>
                    {settings.days} days · {settings.height} m above the ground
                  </dd>
                </div>
              </dl>
              <dl>
                <div>
                  <dt>Longest stretch without direct sunlight</dt>
                  <dd>{duration(row.summary?.dark)}</dd>
                </div>
                <div>
                  <dt>
                    Sun visible · % of your stay
                    <small>hours with any part of the Sun in view</small>
                  </dt>
                  <dd className="answer-sun-percent">
                    {percent(row.summary?.sunlitFraction)}
                  </dd>
                </div>
                <div>
                  <dt>
                    Earth visible · % of your stay
                    <small>hours with any part of Earth in view</small>
                  </dt>
                  <dd className="answer-earth-percent">
                    {percent(row.summary?.earthFraction)}
                  </dd>
                </div>
              </dl>
              <div className="answer-arrival">
                <strong>At the arrival instant only</strong>
                <p>
                  Share of each disc unblocked:{" "}
                  <span>
                    Sun {percent(row.arrival?.sunVisibleDiscFraction)}
                  </span>{" "}
                  <span>
                    Earth {percent(row.arrival?.earthVisibleDiscFraction)}
                  </span>
                </p>
              </div>
              {row.summary ? (
                <button
                  className="answer-inspect"
                  onClick={() => onInspect(row)}
                >
                  See {i === 2 ? "this place" : "this arrival"} in 3D
                </button>
              ) : (
                <p>
                  Choose a date and stay that fit{" "}
                  {manifest.period.startUtc.slice(0, 10)} to{" "}
                  {manifest.period.endUtc.slice(0, 10)}.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="answer-meaning">
        <strong>Two different percentages:</strong> the stay percentage counts
        time with any part visible. The arrival percentage measures how much of
        each disc is visible at that one instant, including terrain and
        geometric Earth eclipses for the Sun. Neither is an electrical-power
        percentage.
      </p>
      <p className="answer-meaning">
        Why it matters: long gaps without Sun affect the opportunity to collect
        solar energy. Seeing Earth creates an opportunity for a direct radio
        link. These measurements do not calculate battery life or guarantee a
        connection.
      </p>
      <details className="plain-help">
        <summary>What do these numbers mean?</summary>
        <dl>
          <div>
            <dt>Longest stretch without sunlight</dt>
            <dd>
              One uninterrupted period when terrain or Earth hides the entire
              Sun. A longer gap may need more stored energy.
            </dd>
          </div>
          <div>
            <dt>Time with some sunlight</dt>
            <dd>
              The share of your stay with any part of the Sun visible. For
              example, 50% means half of the time, not half of the electrical
              power.
            </dd>
          </div>
          <div>
            <dt>Time with Earth in view</dt>
            <dd>
              The share of the stay with any part of Earth above the hills.
              Antennas, ground stations and signal strength are not modeled.
            </dd>
          </div>
          <div>
            <dt>At least / ≥</dt>
            <dd>
              The stretch continues beyond the start or end of your stay. The
              full stretch may be longer.
            </dd>
          </div>
        </dl>
      </details>
    </section>
  );
}
