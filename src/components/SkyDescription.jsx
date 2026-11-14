// AI-assisted component. A text alternative to the sky view, built from the SAME interpolated
// observation that drives the on-screen Sun/Earth disc percentages. No speech, no network.
import { useEffect, useState } from "react";
import { timeAt } from "../lib/analysis.mjs";

const SETTLE_MS = 700;

function deg(v) {
  return (v >= 0 ? "" : "−") + Math.abs(v).toFixed(2) + "°";
}
function body(name, d) {
  if (!d || !Number.isFinite(d.elevationDeg)) return `${name}: not available.`;
  const pct = Math.round(d.fraction * 100);
  const state =
    d.fraction >= 1
      ? "fully above the terrain horizon"
      : d.fraction <= 0
        ? "hidden below the terrain horizon"
        : `${pct < 1 ? "less than 1" : pct > 99 ? "more than 99" : pct}% of the disc above the terrain horizon`;
  return (
    `${name} at azimuth ${d.azimuthDeg.toFixed(0)}°, ${deg(d.elevationDeg)} relative to the local horizontal; ` +
    `terrain horizon in that direction ${deg(d.horizonDeg)}; ${state}.`
  );
}

export function describeObservation(observation, { siteName, height, utc }) {
  if (!observation?.sunDetail || !observation?.earthDetail) return null;
  return (
    `${utc.slice(0, 16).replace("T", " ")} UTC, ${siteName}, observer ${height} m above the ground. ` +
    body("Sun", observation.sunDetail) +
    " " +
    body("Earth", observation.earthDetail)
  );
}

export default function SkyDescription({
  observation,
  siteId,
  siteName,
  height,
  index,
  period,
  playing,
}) {
  // Text is stored with the key it describes, so stale text is never shown or announced.
  const [announced, setAnnounced] = useState({ key: "", text: "" });
  const key = `${siteId}|${height}|${index}`;
  const matches =
    observation &&
    observation.siteId === siteId &&
    observation.index === index &&
    observation.height === height &&
    !observation.frozen;
  useEffect(() => {
    if (playing || !matches || !period) return undefined;
    // Announce only after time settles, so Play and scrubbing do not flood screen readers.
    const t = setTimeout(() => {
      setAnnounced({
        key,
        text:
          describeObservation(observation, {
            siteName,
            height,
            utc: timeAt(period, index),
          }) ?? "",
      });
    }, SETTLE_MS);
    return () => clearTimeout(t);
  }, [playing, matches, observation, siteName, height, index, period, key]);
  const text = !playing && announced.key === key ? announced.text : "";
  return (
    <section
      className="sky-description"
      aria-labelledby="sky-description-title"
    >
      <h3 id="sky-description-title" className="sky-description-title">
        What the observer sees (text)
      </h3>
      {matches ? (
        <p className="sky-description-plain">
          {observation.sun > 0
            ? "The Sun is in view."
            : "The Sun is hidden by the terrain."}{" "}
          {observation.earth > 0
            ? "Earth is in view."
            : "Earth is hidden by the terrain."}{" "}
          This describes the selected location, not every part of the 3D scene.
        </p>
      ) : null}
      <p aria-live="polite" aria-atomic="true">
        {playing
          ? "Paused description: it updates when time stops."
          : text || "Waiting for the sky geometry…"}
      </p>
      <p className="sky-description-note">
        Geometric visibility from the interpolated ephemeris and the terrain
        horizon. Not a radio link, power or operational assessment.
      </p>
    </section>
  );
}
