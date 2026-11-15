import { useEffect, useRef } from "react";

// Original, code-native opening. An illustration of the question (a later
// arrival, a low Sun, a ridge), not computed data or a flight path.
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
    const timer = reduced ? null : setTimeout(onClose, 2600);
    return () => {
      document.body.style.overflow = previousOverflow;
      clearTimeout(timer);
      window.removeEventListener("keydown", escape);
    };
  }, [onClose]);
  const ridge =
    "M0 196 L48 188 L92 192 L130 170 L168 176 L204 146 L236 152 L268 128 L300 138 L336 158 L372 150 L410 172 L452 166 L500 184 L560 178 L600 190";
  return (
    <div
      className="space-opening lc-open"
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
      <button className="opening-skip lc-skip" ref={skip} onClick={onClose}>
        Skip intro <span aria-hidden="true">↗</span>
      </button>
      <div className="lc-grid">
        <div className="lc-brand">
          <svg className="lc-mark" viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <clipPath id="lc-mark-clip">
                <circle cx="32" cy="32" r="22" />
              </clipPath>
            </defs>
            <g clipPath="url(#lc-mark-clip)">
              <circle cx="32" cy="32" r="22" fill="#14130f" />
              <circle className="lc-mark-sun" cx="37" cy="35" r="6.5" fill="#f2b544" />
              <path d="M8 40l7-3 5 2 6-6 5 4 4-2 6 5 6-3 9 4V58H8z" fill="#2a2824" />
              <path
                d="M8 40l7-3 5 2 6-6 5 4 4-2 6 5 6-3 9 4"
                fill="none"
                stroke="#bdb6a8"
                strokeWidth="1.6"
              />
            </g>
            <circle cx="32" cy="32" r="22" fill="none" stroke="#ece7dc" strokeWidth="2" />
          </svg>
          <h1 id="opening-title">Lunacline</h1>
          <p className="lc-descriptor">Lunar arrival comparison</p>
          <p id="opening-description" className="lc-question">
            Same place. A later arrival.
            <br />
            <em>A different sky.</em>
          </p>
          <button ref={enter} className="lc-enter" onClick={onClose}>
            Compare arrival times <span aria-hidden="true">→</span>
          </button>
        </div>
        <svg className="lc-scene" viewBox="0 0 600 260" aria-hidden="true">
          <defs>
            <clipPath id="lc-sky">
              <path d={`${ridge} L600 0 L0 0 Z`} />
            </clipPath>
          </defs>
          {[40, 80, 120].map((y) => (
            <line key={y} className="lc-grid-line" x1="0" x2="600" y1={y} y2={y} />
          ))}
          <path
            className="lc-path"
            d="M20 92 C150 70 300 96 420 150 S560 214 590 222"
          />
          <g clipPath="url(#lc-sky)">
            <circle className="lc-sun" cx="0" cy="0" r="13" />
          </g>
          <path className="lc-ground" d={`${ridge} L600 260 L0 260 Z`} />
          <path className="lc-ridge" d={ridge} pathLength="1" />
          <g className="lc-ruler">
            {Array.from({ length: 15 }, (_, i) => (
              <g key={i} transform={`translate(${20 + i * 40} 236)`}>
                <line y2={i % 2 ? 6 : 12} />
                {i % 2 ? null : <text y="26">+{i / 2} d</text>}
              </g>
            ))}
          </g>
          <line className="lc-cursor" x1="0" x2="0" y1="18" y2="232" />
        </svg>
      </div>
      <p className="lc-credit">
        Opening illustration · not computed data
      </p>
    </div>
  );
}
