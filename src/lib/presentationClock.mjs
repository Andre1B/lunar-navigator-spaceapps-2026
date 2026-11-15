// Display-only interpolation between the slower authoritative clock updates.
// Preserve its phase across delayed React commits. Explicit seeks, loop wraps,
// playback/rate changes create a new segment rather than carrying old frames.
const MAX_LEAD_MS = 100;
const rawIndex = (anchor, now) =>
  anchor.index +
  (anchor.playing
    ? (Math.min(MAX_LEAD_MS, Math.max(0, now - anchor.at)) * anchor.speed) /
      1000
    : 0);

export function createPresentationAnchor(previous, index, playing, speed, now) {
  const continuous =
    previous?.playing &&
    playing &&
    previous.speed === speed &&
    index >= previous.index;
  const carried = continuous
    ? Math.max(index, rawIndex(previous, now), previous.presented ?? index)
    : index;
  const lead =
    continuous && speed > 0
      ? Math.min(MAX_LEAD_MS, Math.max(0, ((carried - index) * 1000) / speed))
      : 0;
  return {
    index,
    playing,
    speed,
    at: now - lead,
    presented: continuous ? previous.presented : null,
  };
}

export function samplePresentation(anchor, now, maximum) {
  const candidate = rawIndex(anchor, now);
  const forward =
    anchor.playing && anchor.presented !== null
      ? Math.max(candidate, anchor.presented)
      : candidate;
  const index = Math.max(0, Math.min(maximum, forward));
  anchor.presented = index;
  return index;
}
