import { memo } from "react";

// These are facts about the served dataset, not a promise that a job succeeded.
export default memo(function CoverageNotice({ manifest }) {
  // Hold the notice's place while the manifest loads, so the content below it
  // does not jump down when the dates arrive.
  if (!manifest?.period)
    return (
      <aside className="coverage-notice" aria-busy="true">
        <p>
          <strong>Computed dates</strong> loading the first and last UTC day…
        </p>
        <p>
          Reading the computed period and the date of the last validated
          dataset refresh before showing any results.
        </p>
        <small>Data generation time loading…</small>
      </aside>
    );
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
