// AI-assisted code. Numeric operations on published/precomputed data, not LLM predictions.
export const DAY_MS = 86400000;
// Date.parse normalizes impossible days (e.g. February 31). Arrival text must
// identify an actual UTC calendar day rather than silently selecting March.
export function parseUtcDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const ms = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(ms) &&
    new Date(ms).toISOString().slice(0, 10) === value
    ? ms
    : null;
}
export function timeAt(period, index) {
  return new Date(
    Date.parse(period.startUtc) + index * period.stepMinutes * 60000,
  ).toISOString();
}
export function indexAt(period, utc) {
  return (
    (Date.parse(utc) - Date.parse(period.startUtc)) /
    (period.stepMinutes * 60000)
  );
}
// A delay is whole days plus whole hours, stored as fractional days
// (days + hours / 24); the hourly dataset resolves it exactly.
export function delayParts(delay) {
  const total = Math.round(Number(delay) * 24);
  return { days: Math.floor(total / 24), hours: total % 24, totalHours: total };
}
export function formatDelay(delay) {
  const { days, hours } = delayParts(delay);
  const d = days ? `${days} ${days === 1 ? "day" : "days"}` : "";
  const h = hours ? `${hours} h` : "";
  return [d, h].filter(Boolean).join(" ") || "0 h";
}
export function windowBounds(period, date, days, delayDays = 0) {
  const arrival = Date.parse(date) + delayDays * DAY_MS;
  if (!Number.isFinite(arrival) || !Number.isFinite(days)) return null;
  const start = indexAt(period, new Date(arrival).toISOString());
  const end = start + (days * 1440) / period.stepMinutes;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end > period.sampleCount - 1 ||
    days <= 0
  )
    return null;
  return { start: Math.round(start), end: Math.round(end) };
}
export function runs(values, predicate, stepH) {
  const intervals = [];
  let begin = null;
  for (let i = 0; i < values.length; i++) {
    const yes = i < values.length - 1 && predicate(values[i]);
    if (yes && begin === null) begin = i;
    if (!yes && begin !== null) {
      intervals.push({
        start: begin,
        end: i,
        hours: (i - begin) * stepH,
        censored: begin === 0 || i === values.length - 1,
      });
      begin = null;
    }
  }
  return intervals;
}
export function summarize(data, height, bounds, stepMinutes = 60) {
  if (!data || !bounds) return null;
  const sun = data.sun.visibleFraction[String(height)].slice(
    bounds.start,
    bounds.end + 1,
  );
  const earth = data.earth.visibleFraction[String(height)].slice(
    bounds.start,
    bounds.end + 1,
  );
  if (
    sun.length < 2 ||
    earth.length !== sun.length ||
    sun.some((v) => !Number.isFinite(v)) ||
    earth.some((v) => !Number.isFinite(v))
  )
    return null;
  const h = stepMinutes / 60;
  const mean = (a) =>
    a.slice(0, -1).reduce((s, v, i) => s + (v + a[i + 1]) / 2, 0) /
    (a.length - 1);
  const fraction = (a) =>
    a.slice(0, -1).filter((v) => v > 0).length / (a.length - 1);
  const longest = (a) =>
    a.reduce((best, r) => (r.hours > best.hours ? r : best), {
      hours: 0,
      censored: false,
    });
  return {
    meanSun: mean(sun),
    sunlitFraction: fraction(sun),
    earthFraction: fraction(earth),
    dark: longest(runs(sun, (v) => v <= 0, h)),
    noEarth: longest(runs(earth, (v) => v <= 0, h)),
    sun,
    earth,
    stepHours: h,
  };
}
export function visibleDiskFraction(elevation, horizon, angularRadius) {
  if (
    !Number.isFinite(elevation) ||
    !Number.isFinite(horizon) ||
    !(angularRadius > 0)
  )
    return null;
  const d = (elevation - horizon) / angularRadius;
  if (d >= 1) return 1;
  if (d <= -1) return 0;
  return (Math.acos(-d) + d * Math.sqrt(1 - d * d)) / Math.PI;
}
export function horizonAt(values, azimuth) {
  const n = values.length;
  const x = ((((azimuth % 360) + 360) % 360) * n) / 360;
  const i = Math.floor(x);
  return values[i % n] * (1 - (x - i)) + values[(i + 1) % n] * (x - i);
}
export function eventSummary(data, height, bounds, period) {
  const sampled = summarize(data, height, bounds, period.stepMinutes);
  if (!sampled || !Array.isArray(data.events)) return sampled;
  const begin = Date.parse(timeAt(period, bounds.start)),
    end = Date.parse(timeAt(period, bounds.end));
  function intervals(body, rise, set) {
    const rises = new Set([
      rise,
      ...(body === "sun" ? ["eclipseDarknessEnd"] : []),
    ]);
    const sets = new Set([
      set,
      ...(body === "sun" ? ["eclipseDarknessStart"] : []),
    ]);
    let visible = data[body].visibleFraction[String(height)][0] > 0;
    const events = data.events
      .filter(
        (e) => e.heightM === height && (rises.has(e.type) || sets.has(e.type)),
      )
      .map((e) => ({ ...e, ms: Date.parse(e.utc) }))
      .sort((a, b) => a.ms - b.ms);
    for (const e of events) {
      if (e.ms <= begin) visible = rises.has(e.type);
    }
    let cursor = begin;
    const spans = [];
    for (const e of events) {
      if (e.ms <= begin || e.ms >= end) continue;
      spans.push({ start: cursor, end: e.ms, visible });
      cursor = e.ms;
      visible = rises.has(e.type);
    }
    spans.push({ start: cursor, end, visible });
    const hidden = spans
      .filter((s) => !s.visible)
      .map((s) => ({
        hours: (s.end - s.start) / 3600000,
        censored: s.start === begin || s.end === end,
      }));
    return {
      fraction:
        spans
          .filter((s) => s.visible)
          .reduce((v, s) => v + s.end - s.start, 0) /
        (end - begin),
      gap: hidden.reduce((v, s) => (s.hours > v.hours ? s : v), {
        hours: 0,
        censored: false,
      }),
    };
  }
  const sun = intervals("sun", "sunrise", "sunset"),
    earth = intervals("earth", "earthrise", "earthset");
  return {
    ...sampled,
    sunlitFraction: sun.fraction,
    earthFraction: earth.fraction,
    dark: sun.gap,
    noEarth: earth.gap,
    durationMethod: "5-minute event search, boundaries refined to <=1 minute",
  };
}
export const percent = (v) => {
  if (!Number.isFinite(v)) return "Not calculated";
  // A thin visible sliver must not be labelled 0% (hidden), nor an almost
  // complete disc 100% (fully visible), merely because of display rounding.
  if (v > 0 && v < 0.001) return "<0.1%";
  if (v > 0.999 && v < 1) return ">99.9%";
  return (v * 100).toFixed(1) + "%";
};
export const hours = (r) =>
  !r ? "Not calculated" : (r.censored ? "≥ " : "") + r.hours.toFixed(0) + " h";
