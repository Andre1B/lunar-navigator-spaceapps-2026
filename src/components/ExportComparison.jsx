import { useRef, useState } from "react";

export default function ExportComparison({ dataset, settings, limit }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function download() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      // Keep the PDF engine and embedded fonts off the initial app-loading path.
      const { downloadComparisonPdf } =
        await import("../lib/comparisonPdf.mjs");
      await downloadComparisonPdf(dataset, settings, limit);
    } catch {
      setError(
        "The PDF could not be prepared. Try again, or use the advanced JSON download below.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="comparison-export" aria-labelledby="export-title">
      <div>
        <h2 id="export-title">Take the comparison with you.</h2>
        <p>
          All three scenarios, Sun and Earth percentages, graphs, every computed
          arrival date, sources and limitations. Styled like this workspace.
          Created locally; nothing is uploaded.
        </p>
      </div>
      <button
        className="button"
        onClick={download}
        disabled={busy || !dataset.manifest}
        aria-describedby="pdf-download-status"
      >
        {busy ? "Preparing your PDF…" : "Download comparison · PDF"}
      </button>
      <p id="pdf-download-status" className="caption" role="status">
        {error ||
          (busy
            ? "Building the full report. Your current comparison stays available."
            : "The advanced JSON record remains available under full measurements.")}
      </p>
    </section>
  );
}
