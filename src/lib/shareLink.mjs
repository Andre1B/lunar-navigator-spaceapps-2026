import { delayParts, parseUtcDay, windowBounds } from "./analysis.mjs";

// A comparison link carries only the six settings, never data or URLs.
// Results are recomputed from the dataset current when the link is opened.
export const STAY_DAYS = [3, 7, 14, 28];
export const DELAY_DAYS = [0, 1, 3, 7, 14, 29];

export function comparisonHash(settings) {
  const q = new URLSearchParams({
    site: settings.siteId,
    h: String(settings.height),
    arr: settings.date,
    days: String(settings.days),
    delay: String(delayParts(settings.delay).days),
    alt: settings.alternative,
  });
  const dh = delayParts(settings.delay).hours;
  if (dh) q.set("dh", String(dh));
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
  if (!["site", "h", "arr", "days", "delay", "dh", "alt"].some((k) => q.has(k)))
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
  const dh = q.has("dh") ? Number(q.get("dh")) : 0;
  const dhOk = Number.isInteger(dh) && dh >= 0 && dh <= 23;
  if (!dhOk) rejected.push("dh");
  const delay = q.has("delay") ? Number(q.get("delay")) : null;
  if (delay !== null || (q.has("dh") && dhOk))
    pick(
      q.has("delay") ? "delay" : "dh",
      "delay",
      (delay === null || DELAY_DAYS.includes(delay)) && dhOk,
      (delay ?? 0) + (dhOk ? dh : 0) / 24,
    );
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
