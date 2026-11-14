import { eventSummary, timeAt, windowBounds } from "./analysis.mjs";

// One calculation path serves the table, short review and downloaded record.
export function comparisonRows(dataset, settings) {
  if (!dataset.manifest) return [];
  return [
    ["Original arrival", settings.siteId, 0],
    ["Delayed arrival", settings.siteId, settings.delay],
    ["Alternative point", settings.alternative, settings.delay],
  ].map(([label, id, offset]) => {
    const bounds = windowBounds(
      dataset.manifest.period,
      settings.date,
      settings.days,
      offset,
    );
    return {
      label,
      id,
      offset,
      bounds,
      summary: eventSummary(
        dataset.sites[id],
        Number(settings.height),
        bounds,
        dataset.manifest.period,
      ),
    };
  });
}

export function assessDarkness(summary, limitH) {
  if (!summary || !Number.isFinite(limitH) || limitH < 0)
    return {
      status: "not-calculated",
      message: "Not calculated for this window or limit.",
    };
  const { hours, censored } = summary.dark;
  if (hours > limitH)
    return {
      status: "exceeds",
      lowerBound: censored,
      marginH: hours - limitH,
      message: `Exceeds your limit by ${censored ? "at least " : ""}${(hours - limitH).toFixed(1)} h.`,
    };
  if (censored)
    return {
      status: "undetermined",
      lowerBound: true,
      marginH: null,
      message:
        "Lower bound only. The full darkness interval may exceed your limit.",
    };
  return {
    status: "within",
    lowerBound: false,
    marginH: limitH - hours,
    message: `Within this limit, with ${(limitH - hours).toFixed(1)} h margin.`,
  };
}

export function comparisonReport(dataset, settings, limitH) {
  const { manifest, validation } = dataset;
  if (!manifest) return null;
  return {
    schemaVersion: "1.0.0",
    reportType: "faithful-comparison",
    generatedAtUtc: new Date().toISOString(),
    project: "Lunar Navigator",
    sourceCode: "https://github.com/Andre1B/lunar-navigator-spaceapps-2026",
    build: typeof __BUILD_INFO__ === "undefined" ? null : __BUILD_INFO__,
    dataset: {
      schemaVersion: manifest.schemaVersion,
      manifestGeneratedAtUtc: manifest.generatedAtUtc,
      integrity: dataset.integrity ?? null,
    },
    settings: { ...settings, exampleDarknessLimitH: limitH },
    coverage: manifest.period,
    scenarios: comparisonRows(dataset, settings).map((r) => {
      const point = manifest.sites.find((s) => s.id === r.id);
      return {
        label: r.label,
        siteId: r.id,
        point,
        arrivalDelayDays: r.offset,
        startUtc: r.bounds ? timeAt(manifest.period, r.bounds.start) : null,
        endUtc: r.bounds ? timeAt(manifest.period, r.bounds.end) : null,
        status: r.summary ? "calculated" : "not-calculated",
        summary: r.summary
          ? {
              meanVisibleSolarDiscFraction: r.summary.meanSun,
              directSunTimeFraction: r.summary.sunlitFraction,
              earthVisibleTimeFraction: r.summary.earthFraction,
              longestDarkness: r.summary.dark,
              longestEarthGap: r.summary.noEarth,
            }
          : null,
        exampleDarknessAssessment: assessDarkness(r.summary, limitH),
      };
    }),
    method: {
      means: "Hourly trapezoidal approximation.",
      durations:
        "5-minute event search, boundaries refined to at most 1 minute; shorter events can be missed.",
      censored:
        "An interval touching a window edge is a lower bound, not the full interval.",
      visibility:
        "Any part of the disc visible above the terrain horizon; not a radio-link guarantee.",
      unavailable:
        "Out-of-coverage or invalid windows are not calculated; no extrapolation.",
    },
    conventions: manifest.conventions,
    provenance: manifest.provenance,
    validation:
      validation?.tests.map(({ id, status, target, result, notes }) => ({
        id,
        status,
        target,
        result,
        notes,
      })) ?? [],
    limitations: [
      ...(manifest.limitations ?? []),
      "User-defined darkness limits are examples, not NASA requirements or battery models.",
      "Free Mode freezes never change this faithful comparison.",
      "Educational research prototype; no landing-safety certification or NASA endorsement.",
    ],
  };
}

export function downloadComparison(report) {
  if (!report) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lunar-navigator-comparison.json";
  anchor.click();
  // Give the browser time to consume the object URL before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
