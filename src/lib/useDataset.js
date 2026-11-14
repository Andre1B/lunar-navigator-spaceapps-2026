import { useEffect, useState } from "react";
export function useDataset() {
  const [state, setState] = useState({
    status: "loading",
    manifest: null,
    sky: null,
    planets: null,
    sites: {},
    validation: null,
    integrity: null,
    error: null,
  });
  useEffect(() => {
    const ac = new AbortController();
    let version = "";
    const read = async (path) => {
      // Revalidate the small manifest; keep every other file on the SAME
      // dataset version. Old browser caches must not mix two- and five-height
      // releases after a deployment.
      const r = await fetch(
        "/data/" + path + (version ? "?v=" + encodeURIComponent(version) : ""),
        {
          signal: ac.signal,
          ...(path === "manifest.json" ? { cache: "no-cache" } : {}),
        },
      );
      if (!r.ok) throw Error("Dataset unavailable: " + path);
      return r.json();
    };
    (async () => {
      try {
        const manifest = await read("manifest.json");
        if (
          manifest.schemaVersion !== "1.0.0" ||
          !manifest.period?.sampleCount ||
          !Array.isArray(manifest.sites) ||
          !Array.isArray(manifest.observerHeightsM) ||
          !manifest.observerHeightsM.length ||
          !manifest.generatedAtUtc
        )
          throw Error("Unsupported dataset schema");
        version = manifest.generatedAtUtc;
        const [sky, validation, planets, integrity, ...sites] =
          await Promise.all([
            read("sky.json"),
            read(manifest.validation.file),
            read("planets.json").catch(() => null),
            read("integrity.json").catch(() => null),
            ...manifest.sites.map((s) => read(s.file)),
          ]);
        if (
          sites.some((site) =>
            manifest.observerHeightsM.some((height) => {
              const key = String(height);
              return (
                site.horizon?.elevationDeg?.[key]?.length !== 720 ||
                site.sun?.visibleFraction?.[key]?.length !==
                  manifest.period.sampleCount ||
                site.earth?.visibleFraction?.[key]?.length !==
                  manifest.period.sampleCount
              );
            }),
          )
        )
          throw Error(
            "Dataset files do not match the declared heights or period. Reload to obtain a consistent release.",
          );
        if (!ac.signal.aborted)
          setState({
            status: "ready",
            manifest,
            sky,
            planets,
            validation,
            integrity,
            sites: Object.fromEntries(sites.map((s) => [s.siteId, s])),
            error: null,
          });
      } catch (error) {
        if (!ac.signal.aborted)
          setState((s) => ({ ...s, status: "error", error: error.message }));
      }
    })();
    return () => ac.abort();
  }, []);
  return state;
}
