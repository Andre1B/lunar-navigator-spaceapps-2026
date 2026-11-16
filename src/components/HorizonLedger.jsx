import { useEffect, useMemo, useRef, useState } from "react";
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
  // Visible azimuth window (zoom and pan); the data never change.
  const [win, setWin] = useState(null),
    [drag, setDrag] = useState(null);
  const valid = win && win.lo === lo && win.hi === hi;
  const vlo = valid ? win.a : lo,
    vhi = valid ? win.b : hi;
  const zoomed = vhi - vlo < hi - lo - 1e-9;
  const setRange = (a, b) => {
    const w = Math.min(hi - lo, Math.max(4, b - a));
    const s = Math.min(Math.max(lo, a), hi - w);
    setWin({ lo, hi, a: s, b: s + w });
  };
  const zoomAt = (f, at = (vlo + vhi) / 2) =>
    setRange(at - (at - vlo) * f, at + (vhi - at) * f);
  const panBy = (d) => setRange(vlo + d, vhi + d);
  const azAtClient = (el, clientX) => {
    const box = el.getBoundingClientRect();
    return vlo + ((((clientX - box.left) / box.width) * W - pad.l) / pw) * (vhi - vlo);
  };
  const X = (a) => pad.l + ((a - vlo) / (vhi - vlo)) * pw,
    Y = (e) => pad.t + ((eHi - e) / (eHi - eLo)) * ph;
  const exaggeration = ph / (eHi - eLo) / (pw / (vhi - vlo));
  const plot = useRef(null),
    onWheel = useRef(null);
  onWheel.current = (e) => {
    if (!zoomed && e.deltaY > 0) return;
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 0.8 : 1.25, azAtClient(plot.current, e.clientX));
  };
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const handler = (e) => onWheel.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);
  const ridgePath = ridge
    .map(([a, e], i) => `${i ? "L" : "M"}${X(a).toFixed(1)},${Y(e).toFixed(1)}`)
    .join("");
  const azStep = compact ? 30 : 10;
  const azTicks = [];
  for (let a = Math.ceil(vlo / azStep) * azStep; a <= vhi; a += azStep)
    azTicks.push(a);
  const elTicks = [];
  for (let e = eLo; e <= eHi; e++) elTicks.push(e);
  const causes = new Set();
  // On-time samples are circles, delayed samples diamonds, so the two stays
  // stay distinguishable without relying on colour.
  const at = (i) => [X(unwrap(site.sun.azDeg[i])), Y(site.sun.elDeg[i])];
  const dots = tracks.map((pts, t) =>
    pts.map((i) => {
      const cause = hiddenCause(site, key, i);
      if (cause !== "lit") causes.add(cause);
      const v = site.sun.visibleFraction[key][i];
      const [x, y] = at(i);
      const r = cause === "lit" ? 1.4 + 2.6 * v : 2;
      const cls = `hl-dot ${t ? "late" : "ontime"} ${cause}`;
      return t ? (
        <path
          key={i}
          className={cls}
          d={`M${x.toFixed(1)},${(y - r * 1.3).toFixed(1)}l${(r * 1.3).toFixed(1)},${(r * 1.3).toFixed(1)}l${(-r * 1.3).toFixed(1)},${(r * 1.3).toFixed(1)}l${(-r * 1.3).toFixed(1)},${(-r * 1.3).toFixed(1)}z`}
        />
      ) : (
        <circle key={i} className={cls} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(1)} />
      );
    }),
  );
  // Where both paths pass the same place IN THIS DRAWING (within 4 units),
  // mark the crossing with a blended colour. A visual coincidence only: the
  // two samples are hours or days apart and are never averaged.
  const crossings = [];
  for (const i of tracks[1]) {
    const [x1, y1] = at(i);
    let best = null;
    for (const j of tracks[0]) {
      const [x0, y0] = at(j);
      const d = Math.hypot(x1 - x0, y1 - y0);
      if (d <= 4 && (!best || d < best.d)) best = { j, d, x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    }
    // Overlapping stays share identical samples; only the boundary where one
    // stay ends as the other begins is marked among those.
    const boundary =
      best && best.j === i && i === rows[0].bounds.end && i === rows[1].bounds.start;
    if (best && best.j === i && !boundary) continue;
    if (best && !crossings.some((c) => Math.hypot(c.x - best.x, c.y - best.y) < 14))
      crossings.push({ ...best, i });
  }
  const pct = (v) => (v * 100).toFixed(1) + "%";
  const utc = (i) => timeAt(period, i).slice(0, 16).replace("T", " ") + " UTC";
  const utcShort = (i) => timeAt(period, i).slice(5, 16).replace("T", " ");
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
      <div className="chart-tools" role="group" aria-label="Sky path view">
        <button type="button" onClick={() => zoomAt(0.5)} disabled={vhi - vlo <= 4}>
          Zoom in
        </button>
        <button type="button" onClick={() => zoomAt(2)} disabled={!zoomed}>
          Zoom out
        </button>
        <button type="button" onClick={() => setWin(null)} disabled={!zoomed}>
          Reset
        </button>
        <span className="chart-window">
          Azimuth {Math.round(((vlo % 360) + 360) % 360)}° to{" "}
          {Math.round(((vhi % 360) + 360) % 360)}° · wheel or +/− to zoom, drag
          or arrows to pan
        </span>
      </div>
      <svg
        ref={plot}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        className={"chart-interactive" + (drag ? " dragging" : "")}
        aria-label={`Computed terrain horizon around ${rows[0].id.replace(/-/g, " ")} at ${height} m, azimuth ${lo} to ${hi} degrees, with the Sun's position every 3 hours during the stay arriving ${d0} and the stay arriving ${d1}. Interactive: plus and minus zoom, left and right arrows pan, 0 resets.`}
        onKeyDown={(e) => {
          const step = (vhi - vlo) / 8;
          const act = {
            "+": () => zoomAt(0.5),
            "=": () => zoomAt(0.5),
            "-": () => zoomAt(2),
            0: () => setWin(null),
            ArrowLeft: () => panBy(-step),
            ArrowRight: () => panBy(step),
          }[e.key];
          if (act) {
            e.preventDefault();
            act();
          }
        }}
        onPointerDown={(e) => {
          if (!zoomed) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setDrag({ x: e.clientX, a: vlo, b: vhi });
        }}
        onPointerMove={(e) => {
          if (!drag) return;
          const box = e.currentTarget.getBoundingClientRect();
          const d = ((drag.x - e.clientX) / box.width) * (W / pw) * (drag.b - drag.a);
          setRange(drag.a + d, drag.b + d);
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <defs>
          <clipPath id="hl-horizon-plot">
            <rect x={pad.l} y={0} width={pw} height={H} />
          </clipPath>
        </defs>
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
        <g clipPath="url(#hl-horizon-plot)">
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
        {crossings.map((c) => {
          const label =
            c.i === c.j
              ? `Same instant, ${utc(c.i)}: the on-time stay ends as the delayed stay begins. Sun ${pct(site.sun.visibleFraction[key][c.i])} visible.`
              : `Both paths pass this spot of the drawing at different times: on-time stay ${utc(c.j)}, Sun ${pct(site.sun.visibleFraction[key][c.j])} visible; delayed stay ${utc(c.i)}, Sun ${pct(site.sun.visibleFraction[key][c.i])} visible.`;
          return (
            <g key={"x" + c.i} className="hl-cross" tabIndex={0} role="img" aria-label={label}>
              <title>{label}</title>
              <circle cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="7" />
            </g>
          );
        })}
        {tracks.map((pts, t) => {
          // Start (ring) and end (bar) of each stay, its letter, UTC and the
          // direction the Sun moves, from one sample to the next.
          const cls = t ? "late" : "ontime",
            first = pts[0],
            last = pts[pts.length - 1],
            [x0, y0] = at(first),
            [x1, y1] = at(last),
            [xa, ya] = at(pts[Math.floor(pts.length / 2)]),
            [xb, yb] = at(pts[Math.floor(pts.length / 2) + 1]),
            ang = (Math.atan2(yb - ya, xb - xa) * 180) / Math.PI,
            dy = t ? 26 : -14;
          return (
            <g key={"m" + t} className={`hl-marks ${cls}`}>
              <circle className="hl-startmark" cx={x0.toFixed(1)} cy={y0.toFixed(1)} r="6" />
              <rect className="hl-endmark" x={(x1 - 1.5).toFixed(1)} y={(y1 - 7).toFixed(1)} width="3" height="14" />
              <path
                className="hl-arrow"
                d="M-6,-4 L2,0 L-6,4"
                transform={`translate(${xa.toFixed(1)} ${(ya - 9).toFixed(1)}) rotate(${ang.toFixed(1)})`}
              />
              {compact ? null : (
                <>
                  <text className={`hl-start ${cls}`} x={x0.toFixed(1)} y={(y0 + dy).toFixed(1)} textAnchor={x0 > W * 0.6 ? "end" : "start"}>
                    {t ? "B" : "A"} start {utcShort(first)}
                  </text>
                  <text className={`hl-start ${cls}`} x={x1.toFixed(1)} y={(y1 + dy).toFixed(1)} textAnchor={x1 > W * 0.6 ? "end" : "start"}>
                    {t ? "B" : "A"} end {utcShort(last)}
                  </text>
                </>
              )}
            </g>
          );
        })}
        </g>
      </svg>
      <figcaption className="hl-legend">
        <span>
          <i className="hl-key ontime" /> A · stay arriving {d0}
        </span>
        <span>
          <i className="hl-key late" /> B · stay arriving {d1}
        </span>
        <span>ring = start · bar = end · arrow = direction the Sun moves · times UTC</span>
        {compact
          ? rows.slice(0, 2).map((r, t) => (
              <span key={"utc" + t}>
                {t ? "B" : "A"} start {utcShort(r.bounds.start)} · end{" "}
                {utcShort(r.bounds.end)} UTC
              </span>
            ))
          : null}
        {crossings.length ? (
          <span>
            <i className="hl-key cross" /> both paths meet in this drawing
            (focus or hover for both UTC times; usually different instants)
          </span>
        ) : null}
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

// How far the Sun's centre is above (+) or below (-) the computed terrain
// horizon in its direction, hour by hour, for each scenario on a common
// elapsed-time axis. Same site files and horizon as every other figure.
// Zoom and pan change only the visible time window, never the values.
function ClearanceChart({ dataset, rows, height, names }) {
  const compact = useCompact();
  const key = String(height),
    W = compact ? 400 : 1360,
    H = compact ? 220 : 260,
    pad = { l: compact ? 34 : 56, r: 10, t: 14, b: 30 };
  const series = useMemo(
    () =>
      rows.map((r) => {
        const site = dataset.sites[r.id];
        const prof = site.horizon.elevationDeg[key];
        const out = [];
        for (let i = r.bounds.start; i <= r.bounds.end; i++)
          out.push(site.sun.elDeg[i] - horizonAt(prof, site.sun.azDeg[i]));
        return out;
      }),
    [dataset, rows, key],
  );
  const n = Math.max(1, ...series.map((s) => s.length - 1));
  const [view, setView] = useState([0, n]),
    [cursor, setCursor] = useState(null),
    [drag, setDrag] = useState(null);
  useEffect(() => {
    setView([0, n]);
    setCursor(null);
  }, [n]);
  const [k0, k1] = view,
    span = k1 - k0;
  const all = series.flat(),
    lo = Math.floor(Math.min(...all, -0.5)),
    hi = Math.ceil(Math.max(...all, 0.5));
  const X = (k) => pad.l + ((k - k0) / span) * (W - pad.l - pad.r),
    Y = (v) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
  const clamp = (a, b) => {
    const w = Math.min(n, Math.max(6, b - a));
    const s = Math.min(Math.max(0, a), n - w);
    return [s, s + w];
  };
  const zoom = (factor, at = cursor ?? (k0 + k1) / 2) =>
    setView(clamp(at - (at - k0) * factor, at + (k1 - at) * factor));
  const pan = (dk) => setView(clamp(k0 + dk, k1 + dk));
  const reset = () => {
    setView([0, n]);
    setCursor(null);
  };
  const toK = (evt) => {
    const box = evt.currentTarget.getBoundingClientRect();
    const x = ((evt.clientX - box.left) / box.width) * W;
    return k0 + ((x - pad.l) / (W - pad.l - pad.r)) * span;
  };
  const moveCursor = (k) => {
    const c = Math.round(Math.min(n, Math.max(0, k)));
    setCursor(c);
    if (c < k0) pan(c - k0);
    else if (c > k1) pan(c - k1);
  };
  const onKey = (e) => {
    const step = e.shiftKey ? 24 : 1;
    const actions = {
      ArrowLeft: () => moveCursor((cursor ?? Math.round(k0)) - step),
      ArrowRight: () => moveCursor((cursor ?? Math.round(k0)) + step),
      "+": () => zoom(0.5),
      "=": () => zoom(0.5),
      "-": () => zoom(2),
      0: reset,
      Home: () => moveCursor(0),
      End: () => moveCursor(n),
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  };
  const cls = ["ontime", "late", "alt"];
  const summary = series.map((sr, j) => {
    const above = sr.filter((v) => v > 0).length;
    return `${"ABC"[j]} ${names[j]}: Sun centre above the horizon in ${((above / sr.length) * 100).toFixed(0)}% of hours; lowest ${Math.min(...sr).toFixed(2)} deg, highest ${Math.max(...sr).toFixed(2)} deg.`;
  });
  const ticks = [];
  for (let e = lo; e <= hi; e++) ticks.push(e);
  // Day ticks, thinned so labels never overlap at any zoom.
  const every = Math.max(1, Math.ceil(span / 24 / (compact ? 6 : 12)));
  const days = [];
  for (let d = Math.ceil(k0 / 24); d * 24 <= k1; d += every) days.push(d);
  const fmtV = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}°`;
  const utcAt = (j, k) =>
    k < series[j].length
      ? timeAt(dataset.manifest.period, rows[j].bounds.start + k)
          .slice(0, 16)
          .replace("T", " ") + " UTC"
      : null;
  const zoomed = span < n;
  // React registers wheel listeners as passive, so preventDefault would be
  // ignored; attach a native non-passive one that always sees fresh state.
  const plot = useRef(null),
    onWheel = useRef(null);
  onWheel.current = (e) => {
    // Let the page scroll past an unzoomed chart when scrolling outward.
    if (!zoomed && e.deltaY > 0) return;
    e.preventDefault();
    zoom(e.deltaY < 0 ? 0.8 : 1.25, toK(e));
  };
  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const handler = (e) => onWheel.current(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);
  return (
    <figure className="hl-clearance">
      <h3 className="hl-kicker">
        How high is the Sun above the ridge? Sun centre minus the terrain
        horizon in its direction, each hour (degrees)
      </h3>
      <div className="chart-tools" role="group" aria-label="Chart view">
        <button type="button" onClick={() => zoom(0.5)} disabled={span <= 6}>
          Zoom in
        </button>
        <button type="button" onClick={() => zoom(2)} disabled={!zoomed}>
          Zoom out
        </button>
        <button type="button" onClick={reset} disabled={!zoomed && cursor === null}>
          Reset
        </button>
        <span className="chart-window">
          Showing hours {Math.round(k0)}–{Math.round(k1)} of {n} after each
          arrival
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={`${summary.join(" ")} Interactive: left and right arrows move the readout by one hour (Shift: one day), plus and minus zoom, 0 resets.`}
        className={"chart-interactive" + (drag ? " dragging" : "")}
        onKeyDown={onKey}
        ref={plot}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setDrag({ x: e.clientX, k0, k1, moved: false });
        }}
        onPointerMove={(e) => {
          if (drag) {
            const box = e.currentTarget.getBoundingClientRect();
            const dk =
              ((drag.x - e.clientX) / box.width) *
              (W / (W - pad.l - pad.r)) *
              (drag.k1 - drag.k0);
            if (Math.abs(e.clientX - drag.x) > 4) {
              setView(clamp(drag.k0 + dk, drag.k1 + dk));
              if (!drag.moved) setDrag({ ...drag, moved: true });
              return;
            }
          }
          if (e.pointerType === "mouse") moveCursor(toK(e));
        }}
        onPointerUp={(e) => {
          if (drag && !drag.moved) moveCursor(toK(e));
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <defs>
          <clipPath id="clearance-plot">
            <rect x={pad.l} y={0} width={W - pad.l - pad.r} height={H} />
          </clipPath>
        </defs>
        {ticks.map((e) => (
          <g key={e}>
            <line className={e === 0 ? "hl-zero" : "hl-grid"} x1={pad.l} x2={W - pad.r} y1={Y(e)} y2={Y(e)} />
            <text className="hl-axis" x={pad.l - 6} y={Y(e) + 4} textAnchor="end">
              {e > 0 ? "+" : e < 0 ? "−" : ""}
              {Math.abs(e)}°
            </text>
          </g>
        ))}
        {days.map((d) => (
          <text key={d} className="hl-axis" x={X(d * 24)} y={H - 8} textAnchor="middle">
            {compact ? `d${d}` : `day ${d}`}
          </text>
        ))}
        <g clipPath="url(#clearance-plot)">
          {series.map((sr, j) => {
            const a = Math.max(0, Math.floor(k0) - 1),
              b = Math.min(sr.length - 1, Math.ceil(k1) + 1);
            let d = "";
            for (let k = a; k <= b; k++)
              d += `${k > a ? "L" : "M"}${X(k).toFixed(1)},${Y(sr[k]).toFixed(1)}`;
            return <path key={j} className={`hl-curve ${cls[j]}`} d={d} />;
          })}
          {cursor !== null ? (
            <line className="chart-cursor" x1={X(cursor)} x2={X(cursor)} y1={pad.t} y2={H - pad.b} />
          ) : null}
        </g>
        <text className="hl-axis" x={W - pad.r} y={Y(0) - 6} textAnchor="end">
          horizon (0°)
        </text>
      </svg>
      <p className="chart-readout" aria-live="polite">
        {cursor === null
          ? "Point at, tap or focus the chart and use the arrow keys to read exact values."
          : series
              .map((sr, j) =>
                cursor < sr.length
                  ? `${"ABC"[j]}: ${fmtV(sr[cursor])} at ${utcAt(j, cursor)}`
                  : `${"ABC"[j]}: outside this stay`,
              )
              .join(" · ") + ` (hour ${cursor} after arrival)`}
      </p>
      <figcaption className="hl-legend">
        <span><i className="hl-key line ontime" /> A · {names[0]}</span>
        <span><i className="hl-key line late" /> B · {names[1]}</span>
        <span><i className="hl-key line alt" /> C · {names[2]}</span>
        <span>
          Vertical axis: degrees of the Sun&apos;s centre above (+) or below (−)
          the ridge. Horizontal axis: hours after each arrival. Above 0° the
          Sun&apos;s centre clears the ridge; the Sun is a 0.53° disc, so near 0°
          it can be partly visible.
        </span>
      </figcaption>
      <ul className="sr-only">
        {summary.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
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
      <ClearanceChart dataset={dataset} rows={rows} height={height} names={names} />
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
          {settings
            ? `${name(settings.siteId)}, ${settings.height} m above the ground, a ${settings.days}-day stay`
            : "loading the place, its height above the ground and the stay"}
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
        {/* While loading, the same two cards hold their place with dashes, so
            the page does not jump when the numbers arrive. */}
        {[0, 1].map((n) => (
          <article key={n} className={n ? "late" : "ontime"}>
            <h3>
              {n
                ? `Arrive ${delay} days later`
                : ready
                  ? `Arrive ${d0}`
                  : "Arrive as planned"}
              <span className="hl-scenario">
                {ready
                  ? `${n ? `${d1} · same place` : "original plan"} · ${settings.height} m · ${settings.days}-day stay`
                  : "Loading the real lunar comparison…"}
              </span>
            </h3>
            <p className="hl-label">Longest stretch without direct sunlight</p>
            <p className="hl-num">{fmt(rows[n])}</p>
            <dl className="hl-facts">
              <div>
                <dt>Hours with some of the Sun in view</dt>
                <dd>
                  {ready ? percent(rows[n].summary.sunlitFraction) : "–"} of
                  the stay
                </dd>
              </div>
              <div>
                <dt>Hours with some of Earth in view</dt>
                <dd>
                  {ready ? percent(rows[n].summary.earthFraction) : "–"} of the
                  stay
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hl-actions">
        <button
          className="button"
          disabled={!ready}
          onClick={() => onOpen(settings)}
        >
          Compare arrival times →
        </button>
        <p className="briefing-source">
          Opens Compare with this example; change the place, height, date or
          delay there. Same calculation as Compare and the PDF: NASA LRO LOLA
          terrain and NAIF SPICE positions. Study points, not certified landing
          sites; sunlight is not electrical power.{" "}
          <a href="#/evidence">Check the method</a>.
        </p>
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
    </section>
  );
}
