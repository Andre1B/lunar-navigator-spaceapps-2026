import { useEffect, useRef, useState } from "react";
import { createAmbientScore } from "../lib/ambientScore.mjs";

export default function AmbientMusic() {
  const engine = useRef(null),
    pending = useRef(false),
    settings = useRef(null);
  const [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(20),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      engine.current?.dispose();
      engine.current = null;
    },
    [],
  );
  useEffect(() => {
    const outside = (e) => {
      if (settings.current?.open && !settings.current.contains(e.target))
        settings.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  async function toggle() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (!engine.current) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) throw new Error("unavailable");
        engine.current = createAmbientScore(new Context(), volume);
      }
      if (playing) {
        await engine.current.pause();
        setPlaying(false);
      } else {
        await engine.current.play();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
      setError(
        "Music is unavailable in this browser. All exploration tools still work.",
      );
      engine.current?.dispose();
      engine.current = null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="ambient-music">
      <button
        className="music-toggle"
        aria-pressed={playing}
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
        Music <span>{playing ? "On" : "Off"}</span>
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
              engine.current?.setVolume(v);
            }}
          />
          <p>
            Original ambient score, synthesized here. No external audio or
            scientific sonification.
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
