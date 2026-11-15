import { useEffect, useRef } from "react";

// Original, code-native illustration. Not a spacecraft trajectory simulation.
export default function SpaceOpening({ onClose }) {
  const skip = useRef(null),
    enter = useRef(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    skip.current?.focus({ preventScroll: true });
    const escape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", escape);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = reduced ? null : setTimeout(onClose, 2400);
    return () => {
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
      window.removeEventListener("keydown", escape);
    };
  }, [onClose]);
  return (
    <div
      className="space-opening"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-title"
      aria-describedby="opening-description"
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        if (e.shiftKey && document.activeElement === skip.current) {
          e.preventDefault();
          enter.current?.focus();
        } else if (!e.shiftKey && document.activeElement === enter.current) {
          e.preventDefault();
          skip.current?.focus();
        }
      }}
    >
      <button className="opening-skip" ref={skip} onClick={onClose}>
        Skip intro <span aria-hidden="true">↗</span>
      </button>
      <div className="opening-stars" aria-hidden="true" />
      <div className="opening-composition">
        <svg
          className="opening-symbol"
          viewBox="0 0 360 260"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="opening-light">
              <stop stopColor="#f6c36f" />
              <stop offset="1" stopColor="#e9f2ff" />
            </linearGradient>
          </defs>
          <circle
            className="opening-orbit"
            cx="180"
            cy="130"
            r="96"
            fill="none"
            stroke="#7495b1"
            strokeWidth="1"
          />
          <circle
            className="opening-moon"
            cx="180"
            cy="130"
            r="54"
            fill="#e4ebf2"
          />
          <path
            className="opening-moon"
            d="M180 76a54 54 0 0 1 0 108z"
            fill="#2776c9"
          />
          <path
            className="opening-trail"
            d="M52 211 308 49"
            fill="none"
            stroke="url(#opening-light)"
            strokeWidth="2"
          />
          <g className="opening-craft">
            <path d="m0-9 5 15-5-3-5 3z" fill="#f4f8ff" />
            <path d="m-2 8 2 8 2-8" fill="#f6c36f" />
          </g>
          <circle
            className="opening-arrival"
            cx="180"
            cy="130"
            r="68"
            fill="none"
            stroke="#78aadd"
          />
        </svg>
        <h1 id="opening-title">Lunar Navigator</h1>
        <p id="opening-description">
          Compare lunar places. See what a delay changes.
        </p>
        <button ref={enter} className="opening-enter" onClick={onClose}>
          Start exploring <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="opening-credit">
        Opening illustration · not a real flight path
      </p>
    </div>
  );
}
