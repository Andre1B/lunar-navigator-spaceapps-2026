// AI-assisted code. Re-uses the same window maths as the comparison table (eventSummary);
// it never extrapolates beyond the computed period.
import { eventSummary, windowBounds } from './analysis.mjs';

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
  if (!siteData || !Number.isFinite(start) || !Number.isFinite(h) || !(d > 0)) return [];
  const out = [];
  for (let k = 0; k < 400; k++) {
    const date = new Date(start + k * DAY_MS).toISOString().slice(0, 10);
    const bounds = windowBounds(period, date, d, 0);
    if (!bounds) break;
    out.push({ date, summary: eventSummary(siteData, h, bounds, period) });
  }
  return out;
}
