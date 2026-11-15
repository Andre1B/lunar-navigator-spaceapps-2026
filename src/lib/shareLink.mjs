import { parseUtcDay, windowBounds } from "./analysis.mjs";

// A comparison link carries only the six settings, never data or URLs.
// Results are recomputed from the dataset current when the link is opened.
export const STAY_DAYS = [3, 7, 14, 28];
export const DELAY_DAYS = [1, 3, 7, 14, 29];

export function comparisonHash(settings) {
  const q = new URLSearchParams({
    site: settings.siteId,
    h: String(settings.height),
    arr: settings.date,
    days: String(settings.days),
    delay: String(settings.delay),
    alt: settings.alternative,
  });
  return "#/compare?" + q.toString();
}

// Returns null when the hash carries no comparison; otherwise the validated
// settings and the reasons any field was rejected (rejected fields are omitted).
// `covered` describes the link's own fields with 7-day defaults; the page reports
// coverage from the settings actually applied.
export function readComparisonHash(hash, manifest) {
  const [route, query] = String(hash).replace(/^#\/?/, "").split("?");
  if (route !== "compare" || !query) return null;
  const q = new URLSearchParams(query);
  if (!["site", "h", "arr", "days", "delay", "alt"].some((k) => q.has(k)))
    return null;
  const ids = new Set(manifest.sites.map((s) => s.id));
  const settings = {},
    rejected = [];
  const pick = (key, field, ok, value) => {
    if (!q.has(key)) return;
    if (ok) settings[field] = value;
    else rejected.push(key);
  };
  pick("site", "siteId", ids.has(q.get("site")), q.get("site"));
  pick("alt", "alternative", ids.has(q.get("alt")), q.get("alt"));
  const h = Number(q.get("h"));
  pick("h", "height", manifest.observerHeightsM.includes(h), h);
  const days = Number(q.get("days"));
  pick("days", "days", STAY_DAYS.includes(days), days);
  const delay = Number(q.get("delay"));
  pick("delay", "delay", DELAY_DAYS.includes(delay), delay);
  const arr = q.get("arr");
  pick("arr", "date", parseUtcDay(arr) !== null, arr);
  const covered =
    settings.date === undefined ||
    (windowBounds(manifest.period, settings.date, settings.days ?? 7, 0) &&
      windowBounds(
        manifest.period,
        settings.date,
        settings.days ?? 7,
        settings.delay ?? 7,
      ));
  return { settings, rejected, covered: !!covered };
}
