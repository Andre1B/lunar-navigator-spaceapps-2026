// AI-assisted code. Reads precomputed, refined terrain-horizon events from sites/*.json;
// it never computes or extrapolates new events.

export const EVENT_TYPES = ["sunrise", "sunset", "earthrise", "earthset"];
export const EVENT_METHOD =
  "Events from a 5-minute search, boundaries refined to at most 1 minute, at the selected observer height. " +
  "A rise or set is when any part of the disc crosses the terrain horizon.";

const NO_TRANSITION = "No transition in the computed period";

/**
 * Next refined event of each type strictly after the displayed instant.
 *
 * @param {object} siteData  sites/<id>.json (needs .events)
 * @param {object} period    manifest.period {startUtc, stepMinutes, sampleCount}
 * @param {number} index     displayed sample index; may be fractional
 * @param {number|string} height observer height in metres (1 or 5)
 * @returns {{status:'ok', nowUtc:string, periodEndUtc:string, height:number,
 *            events:Array<{type:string, utc:string|null, hoursUntil:number|null,
 *                          resolutionMin:number|null, label:string}>}
 *          | {status:'invalid'|'out-of-coverage', reason:string}}
 */
// Strict numeric parse: null, undefined, booleans and blank strings are rejected
// (Number(null) and Number('') would otherwise become 0).
function toFiniteNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string" && v.trim() !== "")
    return Number.isFinite(Number(v)) ? Number(v) : NaN;
  return NaN;
}

// A height is modelled when the dataset carries per-height series for it.
function modelledHeights(siteData) {
  const keys = [siteData?.sun?.visibleFraction, siteData?.horizon?.elevationDeg]
    .filter((o) => o && typeof o === "object")
    .flatMap((o) => Object.keys(o));
  return new Set(keys.map(Number).filter(Number.isFinite));
}

const INVALID = {
  status: "invalid",
  reason: "Event data, period, time or height is unavailable.",
};

export function nextEvents(siteData, period, index, height) {
  const h = toFiniteNumber(height);
  const i = toFiniteNumber(index);
  const stepMin = toFiniteNumber(period?.stepMinutes);
  const count = toFiniteNumber(period?.sampleCount);
  const start =
    typeof period?.startUtc === "string" ? Date.parse(period.startUtc) : NaN;
  if (
    !Array.isArray(siteData?.events) ||
    !Number.isFinite(start) ||
    !(stepMin > 0) ||
    !Number.isInteger(count) ||
    count < 1 ||
    !Number.isFinite(h) ||
    !Number.isFinite(i)
  )
    return INVALID;
  if (!modelledHeights(siteData).has(h))
    return {
      status: "invalid",
      reason: `No data were computed for a ${h} m observer height.`,
    };
  if (i < 0 || i > count - 1)
    return {
      status: "out-of-coverage",
      reason: "The displayed time is outside the computed period.",
    };

  const step = stepMin * 60000;
  const now = start + i * step;
  const end = start + (count - 1) * step;
  // Keep every Date within the valid range (±8.64e15 ms) so toISOString cannot throw.
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(end) ||
    Math.abs(now) > 8.64e15 ||
    Math.abs(end) > 8.64e15
  )
    return INVALID;

  // A modelled height with no events in the period yields "No transition" for every type.
  const candidates = siteData.events
    .filter((e) => e && e.heightM === h && EVENT_TYPES.includes(e.type))
    .map((e) => ({ ...e, ms: Date.parse(e.utc) }))
    .filter((e) => Number.isFinite(e.ms) && e.ms > now && e.ms <= end)
    .sort((a, b) => a.ms - b.ms);

  const events = EVENT_TYPES.map((type) => {
    const next = candidates.find((e) => e.type === type);
    if (!next)
      return {
        type,
        utc: null,
        hoursUntil: null,
        resolutionMin: null,
        label: NO_TRANSITION,
      };
    return {
      type,
      utc: new Date(next.ms).toISOString().replace(".000Z", "Z"),
      hoursUntil: (next.ms - now) / 3600000,
      resolutionMin: Number.isFinite(next.resolutionMin)
        ? next.resolutionMin
        : null,
      label: formatUntil((next.ms - now) / 3600000),
    };
  });
  return {
    status: "ok",
    nowUtc: new Date(now).toISOString(),
    periodEndUtc: new Date(end).toISOString(),
    height: h,
    events,
  };
}

/** "in 3 d 4 h 12 min" style label; minute precision matches the ≤1 min refinement. */
export function formatUntil(hoursUntil) {
  if (!Number.isFinite(hoursUntil) || hoursUntil < 0) return NO_TRANSITION;
  const totalMin = Math.round(hoursUntil * 60);
  if (totalMin < 1) return "in under 1 min";
  const d = Math.floor(totalMin / 1440),
    hr = Math.floor((totalMin % 1440) / 60),
    m = totalMin % 60;
  return (
    "in " +
    [d ? d + " d" : "", hr ? hr + " h" : "", m ? m + " min" : ""]
      .filter(Boolean)
      .join(" ")
  );
}
