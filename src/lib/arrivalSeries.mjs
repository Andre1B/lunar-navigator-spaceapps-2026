// AI-assisted code. Re-uses the same window maths as the comparison table (eventSummary);
// it never extrapolates beyond the computed period.
import { eventSummary, windowBounds } from "./analysis.mjs";

const DAY_MS = 86400000;

/**
 * One faithful window per arrival day for a single point.
 * Arrival days start at the period start (00:00 UTC) and stop at the last day whose
 * whole operating window fits inside the computed period.
 *
 * @returns {Array<{date:string, summary:object|null}>}  [] for invalid input
 */
export function arrivalSeries(siteData, period, height, days) {
  const h = Number(height);
  const d = Number(days);
  const start = Date.parse(period?.startUtc);
  const count = period?.sampleCount,
    step = period?.stepMinutes;
  if (
    !siteData ||
    !Number.isFinite(start) ||
    !Number.isFinite(h) ||
    !Number.isFinite(d) ||
    !(d > 0) ||
    !Number.isInteger(count) ||
    count < 2 ||
    !Number.isFinite(step) ||
    step <= 0 ||
    !Array.isArray(siteData.sun?.visibleFraction?.[String(h)]) ||
    !Array.isArray(siteData.earth?.visibleFraction?.[String(h)])
  )
    return [];
  const out = [];
  const coveredDays = Math.ceil(((count - 1) * step) / 1440);
  for (let k = 0; k <= coveredDays; k++) {
    const date = new Date(start + k * DAY_MS).toISOString().slice(0, 10);
    const bounds = windowBounds(period, date, d, 0);
    if (!bounds) break;
    out.push({ date, summary: eventSummary(siteData, h, bounds, period) });
  }
  return out;
}
