import { useState } from "react";
import Horizon from "./Horizon.jsx";
import { timeAt } from "../lib/analysis.mjs";

export default function ArrivalComparison({
  rows,
  sites,
  period,
  height,
  onInspect,
}) {
  const [selected, setSelected] = useState(0);
  const row = rows[selected];
  const utc = row?.bounds ? timeAt(period, row.bounds.start) : null;
  return (
    <section
      className="chart-section arrival-comparison"
      aria-labelledby="arrival-comparison-title"
    >
      <h2 id="arrival-comparison-title">
        What changes in the sky when arrival slips?
      </h2>
      <p>
        Same point and height. Switch between the two arrival instants to see
        what the terrain hides.
      </p>
      <div
        className="arrival-switch"
        role="group"
        aria-label="Compare arrival skies"
      >
        {rows.slice(0, 2).map((r, i) => (
          <button
            key={r.label}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
          >
            {r.label}
            {i === 1 ? ` · +${r.offset} days` : ""}
          </button>
        ))}
      </div>
      {utc && sites[row.id] ? (
        <>
          <p className="mono arrival-time">
            <time dateTime={utc}>{utc.slice(0, 16).replace("T", " ")} UTC</time>{" "}
            · {height} m observer
          </p>
          <Horizon
            data={sites[row.id]}
            index={row.bounds.start}
            height={height}
          />
          <button onClick={() => onInspect(row.bounds.start)}>
            Inspect this instant in 3D
          </button>
        </>
      ) : (
        <p role="status">
          Not calculated: this arrival is outside the supported period or its
          inputs are invalid.
        </p>
      )}
      <p className="caption">
        These are snapshots at arrival, not averages over the operating window.
        The table above compares the full windows.
      </p>
    </section>
  );
}
