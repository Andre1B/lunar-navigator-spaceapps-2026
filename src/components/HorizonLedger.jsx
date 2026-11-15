import { useEffect, useMemo, useState } from "react";
import { comparisonRows } from "../lib/comparisonReport.mjs";
import { horizonAt, percent, timeAt, windowBounds } from "../lib/analysis.mjs";

// The home experiment, drawn from the point's own computed horizon.
// Every value comes from comparisonRows (the Compare/export path) and the
// published site files; nothing here is illustrative geometry.
export const FEATURED = {
  siteId: "shackleton-rim",
  alternative: "connecting-ridge",
  height: 1,
  date: "2027-02-09",
  days: 7,
};
const FALLBACK = {
  siteId: "connecting-ridge",
  alternative: "shackleton-rim",
  height: 1,
  days: 7,
};
const DELAYS = [3, 7, 14];

function useCompact() {
  const query = "(max-width: 720px)";
  const [compact, setCompact] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setCompact(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return compact;
}

const day = (utc) =>
  new Date(utc).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

// Example settings: the featured case while it is inside the computed period
// for every offered delay, otherwise the dataset's reference date.
export function exampleSettings(manifest) {
  const period = manifest.period;
  const fits = [0, ...DELAYS].every((d) =>
    windowBounds(period, FEATURED.date, FEATURED.days, d),
  );
  if (fits) return { ...FEATURED, featured: true };
  return {
    ...FALLBACK,
    date:
      manifest.coveragePolicy?.asOfUtcDate ?? period.startUtc.slice(0, 10),
    featured: false,
  };
}

function hiddenCause(site, height, i) {
  if (site.sun.visibleFraction[height][i] > 0) return "lit";
  return site.sun.terrainVisibleFraction[height][i] > 0 ? "earth" : "terrain";
}

function HorizonPanel({ site, height, rows, period, compact }) {
  const W = compact ? 400 : 1360,
    H = compact ? 250 : 340,
    pad = { l: compact ? 34 : 56, r: 8, t: 26, b: 34 };
  const key = String(height);
  const tracks = rows.slice(0, 2).map((r) => {
    const pts = [];
    for (let i = r.bounds.start; i <= r.bounds.end; i += 3) pts.push(i);
    return pts;
  });
  // Unwrap azimuths around the first sample so a track crossing 0/360 stays continuous.
  const ref = site.sun.azDeg[tracks[0][0]];
  const unwrap = (a) => {
    let d = a - ref;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return ref + d;
  };
  const azs = tracks.flat().map((i) => unwrap(site.sun.azDeg[i]));
  const lo = Math.floor(Math.min(...azs) - 8),
    hi = Math.ceil(Math.max(...azs) + 8);
  const profile = site.horizon.elevationDeg[key];
  const ridge = [];
  for (let a = lo; a <= hi; a += 0.5)
    ridge.push([a, horizonAt(profile, ((a % 360) + 360) % 360)]);
  const els = [
    ...ridge.map((p) => p[1]),
    ...tracks.flat().map((i) => site.sun.elDeg[i]),
  ];
  const eLo = Math.floor(Math.min(...els) - 0.4),
    eHi = Math.ceil(Math.max(...els) + 0.4);
  const pw = W - pad.l - pad.r,
    ph = H - pad.t - pad.b;
  const X = (a) => pad.l + ((a - lo) / (hi - lo)) * pw,
    Y = (e) => pad.t + ((eHi - e) / (eHi - eLo)) * ph;
  const exaggeration = ph / (eHi - eLo) / (pw / (hi - lo));
  const ridgePath = ridge
    .map(([a, e], i) => `${i ? "L" : "M"}${X(a).toFixed(1)},${Y(e).toFixed(1)}`)
    .join("");
  const azStep = compact ? 30 : 10;
  const azTicks = [];
  for (let a = Math.ceil(lo / azStep) * azStep; a <= hi; a += azStep)
    azTicks.push(a);
  const elTicks = [];
  for (let e = eLo; e <= eHi; e++) elTicks.push(e);
  const causes = new Set();
  const dots = tracks.map((pts, t) =>
    pts.map((i) => {
      const cause = hiddenCause(site, key, i);
      if (cause !== "lit") causes.add(cause);
      const v = site.sun.visibleFraction[key][i];
      return (
        <circle
          key={i}
          className={`hl-dot ${t ? "late" : "ontime"} ${cause}`}
          cx={X(unwrap(site.sun.azDeg[i])).toFixed(1)}
          cy={Y(site.sun.elDeg[i]).toFixed(1)}
          r={cause === "lit" ? (1.4 + 2.6 * v).toFixed(1) : 2}
        />
      );
    }),
  );
  const startLabel = (pts, cls, text) => {
    const x = X(unwrap(site.sun.azDeg[pts[0]])),
      y = Y(site.sun.elDeg[pts[0]]);
    const right = x > W * 0.6;
    return (
      <text
        className={`hl-start ${cls}`}
        x={(x + (right ? -8 : 8)).toFixed(1)}
        y={(y - 12).toFixed(1)}
        textAnchor={right ? "end" : "start"}
      >
        {text}
      </text>
    );
  };
  const d0 = day(timeAt(period, rows[0].bounds.start)),
    d1 = day(timeAt(period, rows[1].bounds.start));
  return (
    <figure className="hl-horizon">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Computed terrain horizon around ${rows[0].id.replace(/-/g, " ")} at ${height} m, azimuth ${lo} to ${hi} degrees, with the Sun's position every 3 hours during the stay arriving ${d0} and the stay arriving ${d1}.`}
      >
        {elTicks.map((e) => (
          <g key={e}>
            <line
              className={e === 0 ? "hl-zero" : "hl-grid"}
              x1={pad.l}
              x2={W - pad.r}
              y1={Y(e)}
              y2={Y(e)}
            />
            <text className="hl-axis" x={pad.l - 6} y={Y(e) + 4} textAnchor="end">
              {e > 0 ? "+" : e < 0 ? "−" : ""}
              {Math.abs(e)}°
            </text>
          </g>
        ))}
        <path
          className="hl-terrain"
          d={`${ridgePath}L${X(hi)},${H - pad.b}L${X(lo)},${H - pad.b}Z`}
        />
        <path className="hl-ridge" d={ridgePath} />
        {azTicks.map((a) => (
          <g key={a}>
            <line
              className="hl-tick"
              x1={X(a)}
              x2={X(a)}
              y1={H - pad.b}
              y2={H - pad.b + 6}
            />
            <text className="hl-axis" x={X(a)} y={H - pad.b + 20} textAnchor="middle">
              {((a % 360) + 360) % 360}°
            </text>
          </g>
        ))}
        <g>{dots[0]}</g>
        <g>{dots[1]}</g>
        {compact ? null : startLabel(tracks[0], "ontime", `arrive ${d0}`)}
        {compact ? null : startLabel(tracks[1], "late", `arrive ${d1}`)}
      </svg>
      <figcaption className="hl-legend">
        <span>
          <i className="hl-key ontime" /> stay arriving {d0}
        </span>
        <span>
          <i className="hl-key late" /> stay arriving {d1}
        </span>
        {causes.has("terrain") ? (
          <span>
            <i className="hl-key hollow" /> Sun hidden by the computed terrain
            horizon
          </span>
        ) : null}
        {causes.has("earth") ? (
          <span>
            <i className="hl-key hollow earth" /> Sun hidden by Earth (eclipse)
          </span>
        ) : null}
        <span>
          Sun every 3 h · azimuth across · elevation up, drawn{" "}
          {Math.round(exaggeration)}× taller than wide · horizon from LRO LOLA
          elevation
        </span>
      </figcaption>
    </figure>
  );
}

function Ledger({ dataset, rows, height, names }) {
  const key = String(height);
  const compact = useCompact();
  const W = compact ? 400 : 1360,
    labelW = compact ? 0 : 236,
    rowH = compact ? 16 : 22,
    earthH = 4;
  let y = 0;
  const items = rows.map((r, n) => {
    const site = dataset.sites[r.id];
    const sun = site.sun.visibleFraction[key].slice(r.bounds.start, r.bounds.end);
    const earth = site.earth.visibleFraction[key].slice(r.bounds.start, r.bounds.end);
    const cw = (W - labelW) / sun.length;
    const top = y + (compact ? 18 : 0);
    let best = null,
      cur = null;
    sun.forEach((v, h) => {
      if (v <= 0) {
        if (cur === null) cur = h;
        if (!best || h + 1 - cur > best[1] - best[0]) best = [cur, h + 1];
      } else cur = null;
    });
    const dark = r.summary?.dark;
    const matches =
      !!best && !!dark && Math.abs(best[1] - best[0] - dark.hours) <= 1.5;
    const block = (
      <g key={r.label}>
        <text className="hl-row" x={0} y={compact ? y + 12 : top + rowH * 0.7}>
          {names[n]}
        </text>
        {sun.map((v, h) => (
          <rect
            key={h}
            className={v > 0 ? "hl-cell" : "hl-cell dark"}
            x={(labelW + h * cw).toFixed(2)}
            y={top}
            width={Math.max(cw - 0.5, 0.5).toFixed(2)}
            height={rowH}
            opacity={v > 0 ? (0.3 + 0.7 * v).toFixed(2) : 1}
          />
        ))}
        {earth.map((v, h) =>
          v > 0 ? (
            <rect
              key={"e" + h}
              className="hl-earth"
              x={(labelW + h * cw).toFixed(2)}
              y={top + rowH + 2}
              width={Math.max(cw - 0.5, 0.5).toFixed(2)}
              height={earthH}
              opacity={(0.35 + 0.65 * v).toFixed(2)}
            />
          ) : null,
        )}
        {Array.from({ length: Math.round(sun.length / 24) + 1 }, (_, d) => (
          <line
            key={"d" + d}
            className="hl-day"
            x1={labelW + d * 24 * cw}
            x2={labelW + d * 24 * cw}
            y1={top - 3}
            y2={top + rowH + earthH + 5}
          />
        ))}
        {dark && dark.hours > 0 ? (
          <g>
            {/* The bracket marks the hourly dark run only when it is the same
                stretch as the refined event duration; otherwise the refined
                value is shown without pointing at a possibly different run. */}
            {matches ? (
              <path
                className="hl-bracket"
                d={`M${labelW + best[0] * cw},${top + rowH + 12}v6H${labelW + best[1] * cw}v-6`}
              />
            ) : null}
            <text
              className="hl-bracket-label"
              x={matches ? labelW + ((best[0] + best[1]) / 2) * cw : W}
              y={top + rowH + 34}
              textAnchor={matches ? "middle" : "end"}
            >
              {dark.censored ? "at least " : ""}
              {dark.hours.toFixed(1)} h without direct sunlight
            </text>
          </g>
        ) : null}
      </g>
    );
    y = top + rowH + earthH + (dark && dark.hours > 0 ? 50 : 22);
    return block;
  });
  const days = rows[0] ? (rows[0].bounds.end - rows[0].bounds.start) / 24 : 0;
  const cw = (W - labelW) / (days * 24 || 1);
  return (
    <figure className="hl-ledger">
      <svg
        viewBox={`0 -6 ${W} ${y + 20}`}
        role="img"
        aria-label={rows
          .map(
            (r, n) =>
              `${names[n]}: longest stretch without direct sunlight ${r.summary ? (r.summary.dark.censored ? "at least " : "") + r.summary.dark.hours.toFixed(1) + " h" : "not calculated"}, Sun visible ${percent(r.summary?.sunlitFraction)} of the stay, Earth visible ${percent(r.summary?.earthFraction)}.`,
          )
          .join(" ")}
      >
        {items}
        {Array.from({ length: days }, (_, d) => (
          <text
            key={d}
            className="hl-axis"
            x={labelW + (d + 0.5) * 24 * cw}
            y={y + 10}
            textAnchor="middle"
          >
            {compact ? d + 1 : `day ${d + 1}`}
          </text>
        ))}
      </svg>
      <figcaption className="hl-legend">
        <span>
          <i className="hl-key cell" /> one cell per hour: brighter = more of
          the Sun&apos;s disc unblocked at that hour
        </span>
        <span>
          <i className="hl-key earthline" /> Earth in view (direct line of
          sight, not a radio link)
        </span>
        <span>
          Stay percentages count hours with any part visible; durations use the
          event search refined to ≤1 min.
        </span>
      </figcaption>
    </figure>
  );
}

// The same two figures for any comparison (used by Compare).
export function LedgerFigures({ dataset, rows, height }) {
  const compact = useCompact();
  const manifest = dataset?.manifest;
  if (!manifest || rows.length !== 3 || !rows.every((r) => r.bounds && r.summary))
    return null;
  const name = (id) =>
    manifest.sites.find((s) => s.id === id)?.name.replace(/\s*\(.*\)$/, "") ?? id;
  const names = rows.map(
    (r) => `${name(r.id)}, ${day(timeAt(manifest.period, r.bounds.start))}`,
  );
  return (
    <section className="hl hl-compare" aria-label="Why: the horizon and the hourly light ledger">
      <h2 className="hl-kicker">
        Why it changes · the computed horizon at {name(rows[0].id)} and the
        Sun&apos;s path in each stay
      </h2>
      <HorizonPanel
        site={dataset.sites[rows[0].id]}
        height={height}
        rows={rows}
        period={manifest.period}
        compact={compact}
      />
      <Ledger dataset={dataset} rows={rows} height={height} names={names} />
    </section>
  );
}

export default function HorizonLedger({ dataset, onOpen }) {
  const [delay, setDelay] = useState(7);
  const compact = useCompact();
  const manifest = dataset?.manifest;
  const base = useMemo(
    () => (manifest ? exampleSettings(manifest) : null),
    [manifest],
  );
  const settings = useMemo(
    () => (base ? { ...base, delay } : null),
    [base, delay],
  );
  const rows = useMemo(
    () =>
      manifest && settings && dataset.sites[settings.siteId]
        ? comparisonRows(dataset, settings)
        : [],
    [dataset, manifest, settings],
  );
  const ready = rows.length === 3 && rows.every((r) => r.summary);
  const site = settings ? dataset.sites?.[settings.siteId] : null;
  const name = (id) =>
    manifest?.sites.find((s) => s.id === id)?.name.replace(/\s*\(.*\)$/, "") ??
    id;
  const fmt = (r) =>
    r?.summary
      ? `${r.summary.dark.censored ? "≥ " : ""}${r.summary.dark.hours.toFixed(1)} h`
      : "–";
  const d0 = ready ? day(timeAt(manifest.period, rows[0].bounds.start)) : "";
  const d1 = ready ? day(timeAt(manifest.period, rows[1].bounds.start)) : "";
  const names = ready
    ? [
        `${name(rows[0].id)}, ${d0}`,
        `${name(rows[1].id)}, ${d1}`,
        `${name(rows[2].id)}, ${d1}`,
      ]
    : [];
  return (
    <section className="delay-briefing hl" aria-labelledby="briefing-title">
      <div className="hl-head">
        <h2 id="briefing-title" className="hl-kicker">
          {base?.featured ? "Featured example" : "Example"} ·{" "}
          {settings ? `${name(settings.siteId)}, ${settings.height} m above the ground, a ${settings.days}-day stay` : "loading"}
        </h2>
        <div
          className="briefing-delays hl-delays"
          role="group"
          aria-label="Try an arrival delay"
        >
          <span aria-hidden="true">Arrive late by</span>
          {DELAYS.map((value) => (
            <button
              key={value}
              aria-pressed={delay === value}
              onClick={() => setDelay(value)}
            >
              +{value} days
            </button>
          ))}
        </div>
      </div>
      <div className="briefing-results hl-readout" aria-live="polite" aria-atomic="true">
        {ready ? (
          <>
            <article>
              <h3>Arrive {d0}</h3>
              <p className="hl-num">{fmt(rows[0])}</p>
              <p>
                longest without direct sunlight · Sun visible{" "}
                {percent(rows[0].summary.sunlitFraction)} of the stay · Earth{" "}
                {percent(rows[0].summary.earthFraction)}
              </p>
            </article>
            <article className="late">
              <h3>Arrive {delay} days later</h3>
              <p className="hl-num">{fmt(rows[1])}</p>
              <p>
                longest without direct sunlight · Sun visible{" "}
                {percent(rows[1].summary.sunlitFraction)} of the stay · Earth{" "}
                {percent(rows[1].summary.earthFraction)}
              </p>
            </article>
          </>
        ) : (
          <p>Loading the real lunar comparison…</p>
        )}
      </div>
      {ready && site ? (
        <>
          <HorizonPanel
            site={site}
            height={settings.height}
            rows={rows}
            period={manifest.period}
            compact={compact}
          />
          <Ledger dataset={dataset} rows={rows} height={settings.height} names={names} />
        </>
      ) : null}
      <div className="hl-actions">
        <button
          className="button"
          disabled={!ready}
          onClick={() => onOpen(settings)}
        >
          Change the place, date or height →
        </button>
        <p className="briefing-source">
          Same calculation as Compare and the PDF: NASA LRO LOLA terrain and
          NAIF SPICE positions. Study points, not certified landing sites;
          sunlight is not electrical power. <a href="#/evidence">Check the method</a>.
        </p>
      </div>
    </section>
  );
}
