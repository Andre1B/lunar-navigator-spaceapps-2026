import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  // Each study point's file (about 2.7 MB) is fetched and parsed only when a
  // page needs that point, with the same version pin and shape checks.
  const manifestRef = useRef(null),
    siteRequests = useRef(new Map()),
    pendingSites = useRef(new Set());
  const requestSites = useCallback((ids) => {
    const manifest = manifestRef.current,
      read = reader.current;
    if (!manifest || !read) {
      for (const id of ids) pendingSites.current.add(id);
      return;
    }
    for (const id of ids) {
      if (siteRequests.current.has(id)) continue;
      const entry = manifest.sites.find((x) => x.id === id);
      if (!entry) continue; // unknown ids never load anything
      const request = read(entry.file)
        .then((site) => {
          const shapeOk =
            site?.siteId === id &&
            manifest.observerHeightsM.every((height) => {
              const key = String(height);
              return (
                site.horizon?.elevationDeg?.[key]?.length === 720 &&
                site.sun?.visibleFraction?.[key]?.length ===
                  manifest.period.sampleCount &&
                site.earth?.visibleFraction?.[key]?.length ===
                  manifest.period.sampleCount
              );
            });
          if (!shapeOk)
            throw Error(
              "Dataset files do not match the declared heights or period. Reload to obtain a consistent release.",
            );
          setState((s) => ({ ...s, sites: { ...s.sites, [id]: site } }));
        })
        .catch((error) => {
          siteRequests.current.delete(id);
          if (error?.name !== "AbortError")
            setState((s) => ({ ...s, status: "error", error: error.message }));
        });
      siteRequests.current.set(id, request);
    }
  }, []);
  // Sky and planet ephemerides (about 7 MB) feed only the 3D view, so they
  // load when it asks (loadSky), not with the comparison data every page needs.
  const reader = useRef(null),
    skyRequest = useRef(null);
  const loadSky = useCallback(() => {
    if (skyRequest.current || !reader.current) return;
    const read = reader.current;
    skyRequest.current = Promise.all([
      read("sky.json"),
      read("planets.json").catch(() => null),
    ])
      .then(([sky, planets]) => setState((s) => ({ ...s, sky, planets })))
      .catch((error) => {
        skyRequest.current = null;
        if (error?.name !== "AbortError")
          setState((s) => ({ ...s, skyError: error.message }));
      });
  }, []);
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
        reader.current = read;
        manifestRef.current = manifest;
        const [validation, integrity] = await Promise.all([
          read(manifest.validation.file),
          read("integrity.json").catch(() => null),
        ]);
        if (!ac.signal.aborted)
          setState((s) => ({
            ...s,
            status: "ready",
            manifest,
            validation,
            integrity,
            error: null,
          }));
        if (wantSky.current) loadSky();
        // Sites requested before the manifest arrived.
        requestSites([...pendingSites.current]);
      } catch (error) {
        if (!ac.signal.aborted)
          setState((s) => ({ ...s, status: "error", error: error.message }));
      }
    })();
    return () => ac.abort();
  }, [loadSky]);
  // A request made before the manifest arrives is honoured once it does.
  const wantSky = useRef(false);
  const requestSky = useCallback(() => {
    wantSky.current = true;
    loadSky();
  }, [loadSky]);
  return useMemo(
    () => ({ ...state, loadSky: requestSky, requireSites: requestSites }),
    [state, requestSky, requestSites],
  );
}
