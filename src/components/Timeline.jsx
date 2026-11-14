import { timeAt } from "../lib/analysis.mjs";
export default function Timeline({ data, height, period, index, onChange }) {
  if (!data) return null;
  const n = period.sampleCount;
  return (
    <section className="timeline">
      <div className="section-heading">
        <h2>Follow the light.</h2>
        <span className="mono">
          {timeAt(period, index).replace("T", " ").slice(0, 16)} UTC
        </span>
      </div>
      {[
        ["Sunlight", data.sun],
        ["Earth visibility", data.earth],
      ].map(([label, body]) => (
        <div className="track-row" key={label}>
          <span>{label}</span>
          <svg
            viewBox={`0 0 ${n} 28`}
            preserveAspectRatio="none"
            role="img"
            aria-label={
              label +
              " timeline; lighter segments mean a greater visible fraction"
            }
          >
            <rect width={n} height="28" fill="#192335" />
            {body.visibleFraction[String(height)].map((v, i) =>
              v > 0 ? (
                <rect
                  key={i}
                  x={i}
                  width="1.1"
                  height="28"
                  fill={label === "Sunlight" ? "#ffc978" : "#2e96f5"}
                  opacity={Math.max(0.12, v)}
                />
              ) : null,
            )}
            <path
              d={`M${index} 0V28`}
              stroke="white"
              strokeWidth={Math.max(2, n / 500)}
            />
          </svg>
        </div>
      ))}
      <label className="sr-only" htmlFor="time-slider">
        Simulation time
      </label>
      <input
        id="time-slider"
        type="range"
        min="0"
        max={n - 1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="between caption">
        <span>{period.startUtc.slice(0, 10)}</span>
        <span>
          Hourly samples · UTC · brighter means more of the disc visible
        </span>
        <span>{period.endUtc.slice(0, 10)}</span>
      </div>
    </section>
  );
}
