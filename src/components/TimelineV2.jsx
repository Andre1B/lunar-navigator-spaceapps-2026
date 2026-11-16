import { memo, useEffect, useMemo, useRef } from "react";
import { timeAt } from "../lib/analysis.mjs";
const Track = memo(function Track({ label, values }) {
  // A rolling two-year dataset must not create tens of thousands of SVG nodes.
  // This is display-only binning; the scientific metrics use the full data.
  const bins = useMemo(() => {
    const count = Math.min(720, values.length);
    return Array.from({ length: count }, (_, bin) => {
      const start = Math.floor((bin * values.length) / count);
      const end = Math.floor(((bin + 1) * values.length) / count);
      let sum = 0;
      for (let i = start; i < end; i++) sum += values[i];
      return sum / (end - start);
    });
  }, [values]);
  // Drawn on a canvas (one bin per pixel column, stretched like the former
  // SVG): the same picture without ~700 DOM nodes per track.
  const canvas = useRef(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1c1b18";
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, bins.length, 28);
    ctx.fillStyle = label === "Sunlight" ? "#f6c36f" : "#d8d1c2";
    bins.forEach((v, i) => {
      if (v <= 0) return;
      ctx.globalAlpha = Math.max(0.12, v);
      ctx.fillRect(i, 0, 1.1, 28);
    });
    ctx.globalAlpha = 1;
  }, [bins, label]);
  return (
    <div className="track-row">
      <span>{label}</span>
      <canvas
        ref={canvas}
        width={bins.length}
        height="28"
        role="img"
        aria-label={
          label + " timeline; brighter means more of the disc visible"
        }
      />
    </div>
  );
});
export default function TimelineV2({
  data,
  height,
  period,
  index,
  onChange,
  compact = false,
}) {
  if (!data) return null;
  return (
    <section className={"timeline " + (compact ? "timeline-compact" : "")}>
      {!compact ? (
        <div className="section-heading">
          <h2>Sunlight and Earth visibility</h2>
          <span className="mono">
            {timeAt(period, index).slice(0, 16).replace("T", " ")} UTC
          </span>
        </div>
      ) : null}
      <div className="timeline-tracks">
        <Track
          label="Sunlight"
          values={data.sun.visibleFraction[String(height)]}
        />
        <Track
          label="Earth visibility"
          values={data.earth.visibleFraction[String(height)]}
        />
        <div
          className="track-cursor"
          style={{
            left: `calc(120px + (100% - 120px) * ${index / (period.sampleCount - 1)})`,
          }}
        />
      </div>
      <label className="sr-only" htmlFor="time-slider">
        Simulation time
      </label>
      <input
        id="time-slider"
        type="range"
        min="0"
        max={period.sampleCount - 1}
        step="0.01"
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="between caption">
        <span>{period.startUtc.slice(0, 10)}</span>
        <span>
          Gold: visible Sun · Light: visible Earth · display bins average hourly
          samples
        </span>
        <span>{period.endUtc.slice(0, 10)}</span>
      </div>
    </section>
  );
}
