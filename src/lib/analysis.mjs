// AI-assisted code. Numeric operations on published/precomputed data, not LLM predictions.
export const DAY_MS = 86400000;
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
    let visible = data[body].visibleFraction[String(height)][0] > 0;
    const events = data.events
      .filter(
        (e) => e.heightM === height && (e.type === rise || e.type === set),
      )
      .map((e) => ({ ...e, ms: Date.parse(e.utc) }))
      .sort((a, b) => a.ms - b.ms);
    for (const e of events) {
      if (e.ms <= begin) visible = e.type === rise;
    }
    let cursor = begin;
    const spans = [];
    for (const e of events) {
      if (e.ms <= begin || e.ms >= end) continue;
      spans.push({ start: cursor, end: e.ms, visible });
      cursor = e.ms;
      visible = e.type === rise;
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
export const percent = (v) =>
  v == null ? "Not calculated" : (v * 100).toFixed(1) + "%";
export const hours = (r) =>
  !r ? "Not calculated" : (r.censored ? "≥ " : "") + r.hours.toFixed(0) + " h";
