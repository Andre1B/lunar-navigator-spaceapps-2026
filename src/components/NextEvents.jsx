// AI-assisted component. Shows precomputed terrain-horizon events; no prediction is made here.
import { useMemo } from "react";
import { createNextEventsReader, EVENT_METHOD } from "../lib/nextEvents.mjs";

const NAMES = {
  sunrise: "Sun comes into view",
  sunset: "Sun leaves view",
  earthrise: "Earth comes into view",
  earthset: "Earth leaves view",
};

export default function NextEvents({
  siteData,
  period,
  index,
  height,
  onInspect,
}) {
  const readEvents = useMemo(
    () => createNextEventsReader(siteData, period, height),
    [siteData, period, height],
  );
  const result = useMemo(() => readEvents(index), [readEvents, index]);
  return (
    <section className="next-events" aria-labelledby="next-events-title">
      <h3 id="next-events-title" className="next-events-title">
        Next changes in the sky
      </h3>
      {result.status !== "ok" ? (
        <p className="next-events-unavailable" role="status">
          {result.reason}
        </p>
      ) : (
        <>
          <p className="next-events-context">
            After {result.nowUtc.slice(0, 16).replace("T", " ")} UTC · observer{" "}
            {result.height} m · computed until{" "}
            {result.periodEndUtc.slice(0, 10)}
          </p>
          <dl className="next-events-list">
            {result.events.map((e) => (
              <div
                key={e.type}
                className={
                  "next-events-item next-events-" +
                  e.type +
                  (e.utc ? "" : " next-events-none")
                }
              >
                <dt className="next-events-name">
                  {NAMES[e.type]}
                  {e.cause === "earth-occultation"
                    ? " - Earth occultation"
                    : ""}
                </dt>
                <dd className="next-events-value">
                  {e.utc ? (
                    <>
                      <span className="next-events-until">{e.label}</span>{" "}
                      <time className="next-events-time" dateTime={e.utc}>
                        {e.utc.slice(0, 16).replace("T", " ")} UTC
                      </time>
                      {e.resolutionMin ? (
                        <span className="next-events-resolution">
                          {" "}
                          (±{e.resolutionMin} min)
                        </span>
                      ) : null}
                      {onInspect ? (
                        <div
                          className="event-inspection"
                          role="group"
                          aria-label={NAMES[e.type] + ": inspect nearby times"}
                        >
                          {[-5, 5].map((minutes) => {
                            const target =
                              (Date.parse(e.utc) +
                                minutes * 60000 -
                                Date.parse(period.startUtc)) /
                              (period.stepMinutes * 60000);
                            return (
                              <button
                                key={minutes}
                                disabled={
                                  target < 0 || target > period.sampleCount - 1
                                }
                                onClick={() => onInspect(target)}
                              >
                                {Math.abs(minutes)} min{" "}
                                {minutes < 0 ? "before" : "after"}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <span className="next-events-until">{e.label}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="next-events-method caption">
            {EVENT_METHOD} Shorter events can be missed. Geometry only: not a
            forecast of power, communication or operations.
          </p>
        </>
      )}
    </section>
  );
}
