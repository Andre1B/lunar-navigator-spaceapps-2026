import { useEffect, useRef, useState } from "react";
import { createAmbientScore } from "../lib/ambientScore.mjs";

const preferenceKey = "lunar-music-v1";
function musicEnabled() {
  try {
    return localStorage.getItem(preferenceKey) !== "off";
  } catch {
    return true;
  }
}

const volumeKey = "lunar-music-volume-v1";
// Default 50%; a volume the visitor chose before is kept.
function savedVolume() {
  try {
    const v = Number(localStorage.getItem(volumeKey));
    return localStorage.getItem(volumeKey) !== null && v >= 0 && v <= 100
      ? v
      : 50;
  } catch {
    return 50;
  }
}

export default function AmbientMusic() {
  const [enabled, setEnabled] = useState(musicEnabled);
  const engine = useRef(null),
    audioContext = useRef(null),
    pending = useRef(false),
    settings = useRef(null),
    mounted = useRef(false),
    active = useRef(false),
    wanted = useRef(enabled),
    volumeRef = useRef(savedVolume());
  const [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(volumeRef.current),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  function ensureEngine() {
    if (!audioContext.current) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error("unavailable");
      const context = new Context();
      audioContext.current = context;
      context.onstatechange = () => {
        if (!mounted.current) return;
        if (context.state === "running" && wanted.current) void start();
        else {
          active.current = false;
          setPlaying(false);
        }
      };
      engine.current = createAmbientScore(context, volumeRef.current);
    }
    return engine.current;
  }
  async function start() {
    if (
      !mounted.current ||
      !wanted.current ||
      active.current ||
      pending.current ||
      audioContext.current?.state !== "running"
    )
      return;
    pending.current = true;
    try {
      await engine.current.play();
      if (!mounted.current) return;
      if (!wanted.current) {
        await engine.current.pause();
        return;
      }
      active.current = audioContext.current.state === "running";
      setPlaying(active.current);
      setError("");
    } catch {
      if (mounted.current)
        setError("Music is unavailable. All exploration tools still work.");
    } finally {
      pending.current = false;
    }
  }
  function requestPlayback() {
    if (!wanted.current || !mounted.current) return;
    try {
      ensureEngine();
      const context = audioContext.current;
      // Browsers may hold resume until a real user gesture. Never keep the UI
      // busy or start the note scheduler while the context is suspended.
      if (context.state === "running") void start();
      else
        void context
          .resume()
          .then(() => {
            if (mounted.current && wanted.current) void start();
          })
          .catch(() => {});
    } catch {
      if (mounted.current)
        setError("Music is unavailable. All exploration tools still work.");
    }
  }
  useEffect(() => {
    mounted.current = true;
    requestPlayback();
    const unlock = (event) => {
      if (event.target?.closest?.(".music-toggle")) return;
      if (
        event.type === "keydown" &&
        (event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.key === "Escape")
      )
        return;
      requestPlayback();
    };
    // A soft one-shot chime other parts of the app may request (the intro's
    // Sun glint). Only when music is on and already running, at its volume;
    // it never unlocks audio or plays before a user gesture.
    const chime = () => {
      const context = audioContext.current;
      if (!wanted.current || !active.current || context?.state !== "running")
        return;
      const level = (volumeRef.current / 100) * 0.12;
      if (level <= 0) return;
      const t = context.currentTime;
      for (const [freq, share] of [
        [880, 1],
        [1320, 0.35],
      ]) {
        const osc = context.createOscillator(),
          gain = context.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(level * share, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        osc.connect(gain).connect(context.destination);
        osc.start(t);
        osc.stop(t + 1.7);
      }
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("lunacline:chime", chime);
    return () => {
      mounted.current = false;
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("lunacline:chime", chime);
      if (audioContext.current) audioContext.current.onstatechange = null;
      engine.current?.dispose();
      engine.current = null;
      audioContext.current = null;
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const outside = (event) => {
      if (settings.current?.open && !settings.current.contains(event.target))
        settings.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  async function toggle() {
    if (pending.current) return;
    const next = !wanted.current;
    wanted.current = next;
    setEnabled(next);
    setError("");
    try {
      localStorage.setItem(preferenceKey, next ? "on" : "off");
    } catch {
      /* Optional preference. */
    }
    if (next) {
      requestPlayback();
      return;
    }
    active.current = false;
    setPlaying(false);
    pending.current = true;
    setBusy(true);
    try {
      await engine.current?.pause();
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="ambient-music">
      <button
        className="music-toggle"
        aria-pressed={enabled}
        data-playing={playing}
        title={
          enabled && !playing
            ? "Enabled: playback starts on your first interaction if the browser blocks autoplay."
            : "Toggle background music"
        }
        disabled={busy}
        onClick={toggle}
      >
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 8v4m4-7v10m4-12v14m4-11v8m3-6v4" />
        </svg>
        Music <span>{playing ? "On" : enabled ? "Ready" : "Off"}</span>
      </button>
      <details
        className="music-settings"
        ref={settings}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.currentTarget.open = false;
            e.currentTarget.querySelector("summary")?.focus();
            e.stopPropagation();
          }
        }}
      >
        <summary
          aria-label="Music volume and credits"
          title="Music volume and credits"
        >
          <svg
            viewBox="0 0 20 20"
            width="16"
            height="16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 6h14M3 14h14M7 3v6m6 2v6" />
          </svg>
        </summary>
        <div>
          <label htmlFor="music-volume">
            Music volume <output htmlFor="music-volume">{volume}%</output>
          </label>
          <input
            id="music-volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              volumeRef.current = v;
              engine.current?.setVolume(v);
              try {
                localStorage.setItem(volumeKey, String(v));
              } catch {
                // Storage can be unavailable; the volume still applies now.
              }
            }}
          />
          <p>
            Music starts automatically where the browser allows it, otherwise on
            your first interaction. Your Off choice is remembered. Original
            space score: warm chords, a soft bass pulse and answering arpeggios.
            Synthesized here; no external audio or scientific sonification.
          </p>
          <a href="#/credits">Music credits</a>
        </div>
      </details>
      {error ? (
        <span className="music-error" role="status">
          {error}
        </span>
      ) : null}
    </div>
  );
}
