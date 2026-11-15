import { useRef, useState } from "react";
import {
  comparisonReport,
  downloadComparison,
} from "../lib/comparisonReport.mjs";

export default function ExportComparison({ dataset, settings, limit }) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  function downloadJson() {
    downloadComparison(comparisonReport(dataset, settings, limit));
    setStatus("JSON saved: settings, results, UTC times, sources and limits.");
  }
  async function downloadPdf() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setStatus("Building the PDF. Your current comparison stays available.");
    try {
      // Keep the PDF engine and embedded fonts off the initial app-loading path.
      const { downloadComparisonPdf } =
        await import("../lib/comparisonPdf.mjs");
      await downloadComparisonPdf(dataset, settings, limit);
      setStatus("PDF saved.");
    } catch {
      setStatus("The PDF could not be prepared. The JSON record is unaffected.");
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
          A JSON record of these settings, the three results with their UTC
          times, the dataset version, sources, method and limitations, ready
          to check or reuse. Created locally; nothing is uploaded.
        </p>
      </div>
      <div className="export-actions">
        <button
          className="button"
          onClick={downloadJson}
          disabled={!dataset.manifest}
          aria-describedby="export-status"
        >
          Download comparison · JSON
        </button>
        <button
          className="button secondary"
          onClick={downloadPdf}
          disabled={busy || !dataset.manifest}
          aria-describedby="export-status"
        >
          {busy ? "Preparing PDF…" : "PDF summary"}
        </button>
      </div>
      <p id="export-status" className="caption" role="status">
        {status}
      </p>
    </section>
  );
}
