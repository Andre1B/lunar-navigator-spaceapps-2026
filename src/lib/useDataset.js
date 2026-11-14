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
    const read = async (path) => {
      const r = await fetch("/data/" + path, { signal: ac.signal });
      if (!r.ok) throw Error("Dataset unavailable: " + path);
      return r.json();
    };
    (async () => {
      try {
        const manifest = await read("manifest.json");
        if (
          manifest.schemaVersion !== "1.0.0" ||
          !manifest.period?.sampleCount ||
          !Array.isArray(manifest.sites)
        )
          throw Error("Unsupported dataset schema");
        const [sky, validation, planets, integrity, ...sites] =
          await Promise.all([
            read("sky.json"),
            read(manifest.validation.file),
            read("planets.json").catch(() => null),
            read("integrity.json").catch(() => null),
            ...manifest.sites.map((s) => read(s.file)),
          ]);
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
