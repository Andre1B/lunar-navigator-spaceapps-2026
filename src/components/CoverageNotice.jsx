import { memo } from "react";

// These are facts about the served dataset, not a promise that a job succeeded.
export default memo(function CoverageNotice({ manifest }) {
  if (!manifest?.period) return null;
  const policy = manifest.coveragePolicy;
  const today = new Date().toISOString().slice(0, 10);
  const stale = policy?.asOfUtcDate && policy.asOfUtcDate < today;
  return (
    <aside
      className={"coverage-notice" + (stale ? " refresh-pending" : "")}
      aria-label="Computed dates and dataset update"
    >
      <p>
        <strong>Computed dates</strong> {manifest.period.startUtc.slice(0, 10)}{" "}
        to {manifest.period.endUtc.slice(0, 10)} UTC
      </p>
      {policy?.mode === "rolling-calendar-years" ? (
        <p>
          One calendar year before and after {policy.asOfUtcDate}. Older days
          leave the active window when the dataset refreshes.
          {stale
            ? " The daily refresh is pending; this is the last validated dataset."
            : ""}
        </p>
      ) : null}
      <small>
        Data generated {manifest.generatedAtUtc?.replace("T", " ")} · no
        extrapolation outside this period.
      </small>
    </aside>
  );
});
