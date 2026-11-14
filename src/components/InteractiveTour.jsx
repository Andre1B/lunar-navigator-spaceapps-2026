// Nonmodal, keyboard-accessible tour. The actual application stays interactive.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export const tourSteps = [
  {
    route: "home",
    target: '[data-tour="purpose"]',
    title: "A lunar decision, made understandable.",
    body: "This tool helps you explore where sunlight reaches the Moon and when a location can see Earth. You can compare dates and ask what happens if arrival is delayed.",
    try: "You can skip this tour at any time. Every screen remains available.",
  },
  {
    route: "simulator",
    target: '[data-tour="camera-presets"]',
    title: "Choose a way to explore.",
    body: "The named cameras take you to the Moon and Earth, above the south pole, into the surface sky or over real local terrain.",
    try: "Try a camera preset. Drag the scene to look around; use the camera controls if you prefer a keyboard.",
  },
  {
    route: "simulator",
    target: '[data-tour="sim-location"]',
    title: "Choose a location and height.",
    body: "These four points come from published lunar studies. A taller observer can see over some terrain, so 1 metre and 5 metres can produce different results.",
    try: "Choose another location or observer height. These are study points, not certified landing sites.",
  },
  {
    route: "simulator",
    target: '[data-tour="sim-mode"]',
    title: "Real time or a deliberate experiment?",
    body: "Faithful Mode keeps every body on the same astronomical clock. Free Mode lets you freeze individual motions to understand what they change.",
    try: "Use Faithful Mode for the mission comparison. Free configurations are explicitly artificial.",
  },
  {
    route: "simulator",
    target: '[data-tour="time-controls"]',
    title: "Make the sky move.",
    body: "Play advances the simulation. Pause holds the current time. You can also drag the timeline or step forward. The date shown is simulated UTC, not the date on your computer.",
    try: "Press Play, watch the light change, then pause.",
  },
  {
    route: "simulator",
    target: '[data-tour="light-tracks"]',
    title: "Read two different signals.",
    body: "Gold shows the visible fraction of the Sun. Cyan shows the visible fraction of Earth. A dark track means the terrain hides that body at the selected point.",
    try: "Look for a period when one track is bright and the other is dark. Visibility alone is not a power or radio-link guarantee.",
  },
  {
    route: "compare",
    target: '[data-tour="scenario-table"]',
    title: "Compare three versions of a plan.",
    body: "The original arrival, the same location after a delay and an alternative location use the same operating duration and observer height.",
    try: "Compare the sunlight and the longest darkness. There is no universally best location.",
  },
  {
    route: "compare",
    target: '[data-tour="arrival-delay"]',
    title: "Test the unexpected.",
    body: "Change the arrival delay. The result can improve or worsen, depending on the location and dates. Values outside the documented period are not calculated.",
    try: "Try +3 and +7 days, then compare the alternatives again.",
  },
  {
    route: "compare",
    target: '[data-tour="example-constraint"]',
    title: "Explain a trade-off.",
    body: "This example limit lets you ask whether an interval of darkness is acceptable to your scenario. You choose the limit; it is not a NASA requirement.",
    try: "Change the limit and see which scenarios exceed it. “≥” means an interval reaches the edge of the selected window.",
  },
  {
    route: "evidence",
    target: '[data-tour="validation"]',
    title: "Check before you trust.",
    body: "Evidence links the calculations to source data and executed checks. Credits identifies the open-source projects and their licenses.",
    try: "You are ready to explore. Open the guided analysis for a walkthrough, or use any screen directly.",
  },
];
const PAD = 16,
  GAP = 16;
const routeNow = () => location.hash.slice(2).split("?")[0] || "home";
const overlap = (a, b) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
// Pick the card position from its measured size. Prefers a placement that fits
// the viewport without covering the target: below, above, right, then left.
// Falls back to the least-covering clamped position.
export function placeCard(rect, card, vw, vh) {
  const w = Math.min(card.w, vw - 2 * PAD),
    h = Math.min(card.h, vh - 2 * PAD);
  const clampX = (x) => Math.max(PAD, Math.min(vw - w - PAD, x)),
    clampY = (y) => Math.max(PAD, Math.min(vh - h - PAD, y));
  if (!rect)
    return { left: clampX((vw - w) / 2), top: clampY((vh - h) / 3), w, h };
  const cx = rect.left + rect.width / 2,
    cy = rect.top + rect.height / 2;
  const target = {
    left: rect.left - 6,
    top: rect.top - 6,
    right: rect.left + rect.width + 6,
    bottom: rect.top + rect.height + 6,
  };
  const options = [
    { left: clampX(cx - w / 2), top: target.bottom + GAP },
    { left: clampX(cx - w / 2), top: target.top - GAP - h },
    { left: target.right + GAP, top: clampY(cy - h / 2) },
    { left: target.left - GAP - w, top: clampY(cy - h / 2) },
  ];
  const box = (o) => ({
    left: o.left,
    top: o.top,
    right: o.left + w,
    bottom: o.top + h,
  });
  const fits = (o) =>
    o.left >= PAD &&
    o.top >= PAD &&
    o.left + w <= vw - PAD &&
    o.top + h <= vh - PAD;
  const good = options.find(fits);
  if (good) return { ...good, w, h };
  // No clean side: clamp each candidate and keep the one covering the target least.
  let best = null;
  for (const o of options) {
    const c = { left: clampX(o.left), top: clampY(o.top) };
    const cover = overlap(box(c), target);
    if (!best || cover < best.cover) best = { ...c, cover };
  }
  return { left: best.left, top: best.top, w, h };
}
const sameRect = (a, b) =>
  a &&
  b &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;
export default function InteractiveTour({
  index,
  onChange,
  onClose,
  onNavigate,
}) {
  const step = tourSteps[index],
    box = useRef(null),
    expected = useRef(step.route),
    closing = useRef(onClose),
    [rect, setRect] = useState(null),
    [card, setCard] = useState({ w: 370, h: 260 }),
    [vp, setVp] = useState({ w: innerWidth, h: innerHeight });
  closing.current = onClose;
  expected.current = step.route;
  // Measure the real card, including text reflow when the viewport narrows.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () =>
      setCard((c) =>
        c.w === el.offsetWidth && c.h === el.scrollHeight
          ? c
          : { w: el.offsetWidth, h: el.scrollHeight },
      );
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index]);
  useEffect(() => {
    onNavigate(step.route);
    setRect(null);
    let initial = true,
      raf,
      tries = 0;
    const measure = () => {
      const el = document.querySelector(step.target);
      if (!el) {
        // Route may still be rendering; keep looking a little, then show a centred card.
        if (initial && tries++ < 120) raf = requestAnimationFrame(measure);
        return;
      }
      const r = el.getBoundingClientRect();
      if (initial) {
        initial = false;
        // Leave room for the card: bring the target into the upper-middle of the screen.
        const room = card.h + GAP + PAD;
        const ok =
          r.top >= 80 &&
          r.bottom <= innerHeight - Math.min(room, innerHeight * 0.45);
        if (!ok) el.scrollIntoView({ block: "center", behavior: "auto" });
        raf = requestAnimationFrame(measure);
        return;
      }
      const next = {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      };
      setRect((old) => (sameRect(old, next) ? old : next));
    };
    const resize = () => {
      setVp({ w: innerWidth, h: innerHeight });
      measure();
    };
    const observer = new MutationObserver(() => {
      if (initial) measure();
    });
    observer.observe(document.getElementById("root"), {
      childList: true,
      subtree: true,
    });
    raf = requestAnimationFrame(measure);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", measure, true);
    box.current?.focus({ preventScroll: true });
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closing.current();
      }
    };
    // Tour-driven navigation lands on the step's route; anything else is the visitor leaving.
    const hash = () => {
      if (routeNow() !== expected.current) closing.current();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("hashchange", hash);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("hashchange", hash);
    };
  }, [index]);
  const place = placeCard(rect, card, vp.w, vp.h);
  return createPortal(
    <div className="tour-layer">
      {rect ? (
        <div
          className="tour-spotlight"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : null}
      <section
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        className="tour-card"
        style={{
          left: place.left,
          top: place.top,
          width: Math.min(370, vp.w - 2 * PAD),
          maxHeight: vp.h - 2 * PAD,
          overflowY: "auto",
        }}
      >
        <div className="between">
          <span className="mono">
            INTERACTIVE TOUR · {index + 1} / {tourSteps.length}
          </span>
          <button aria-label="Close tutorial" onClick={onClose}>
            ×
          </button>
        </div>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <p className="tour-try">{step.try}</p>
        <div className="tour-actions">
          <button disabled={!index} onClick={() => onChange(index - 1)}>
            Back
          </button>
          <button className="tour-skip" onClick={onClose}>
            Skip tour
          </button>
          <button
            className="button"
            onClick={() =>
              index === tourSteps.length - 1 ? onClose() : onChange(index + 1)
            }
          >
            {index === tourSteps.length - 1 ? "Start exploring" : "Next"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
