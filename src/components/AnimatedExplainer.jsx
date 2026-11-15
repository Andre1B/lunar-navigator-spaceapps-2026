import { useEffect, useState } from "react";
const steps = [
  {
    title: "Choose the same question",
    text: "Start with a location, arrival date and length of stay. Keep the observer height the same when comparing a delay.",
    action: "Open Compare",
    route: "compare",
  },
  {
    title: "Move the arrival, not the goal",
    text: "Compare the original arrival with the same place seven days later. The third result uses another place on that delayed date.",
    action: "Try the comparison",
    route: "compare",
  },
  {
    title: "See why the answer changes",
    text: "A low Sun can slide behind a ridge. The surface view explains the geometry; light-path lines are an optional diagram.",
    action: "Open the simulator",
    route: "simulator",
  },
  {
    title: "Read a duration, then inspect it",
    text: "Longest stretch without sunlight is a time interval. Sun in view is the visible part of the disc at one instant. They answer different questions.",
    action: "Check the evidence",
    route: "evidence",
  },
];
export default function AnimatedExplainer({ onOpen }) {
  const [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (step === steps.length - 1) setPlaying(false);
      else setStep(step + 1);
    }, 5500);
    return () => clearTimeout(timer);
  }, [playing, step]);
  const current = steps[step];
  return (
    <section className="animated-explainer" aria-labelledby="explainer-title">
      <div className="explainer-header">
        <h2 id="explainer-title">The comparison in four moves.</h2>
        <button
          aria-pressed={playing}
          onClick={() => {
            if (step === 3 && !playing) setStep(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? "Pause walkthrough" : "Play walkthrough"}
        </button>
      </div>
      <div className={"explainer-stage explainer-step-" + step}>
        <svg
          viewBox="0 0 640 260"
          role="img"
          aria-label={
            current.title +
            ". Animated illustrative diagram, not measured terrain."
          }
        >
          <path className="ex-orbit" d="M40 190Q320-60 600 190" fill="none" />
          <circle
            className="ex-sun"
            cx={step === 2 ? 410 : 510}
            cy={step === 2 ? 125 : 65}
            r="17"
          />
          <path
            className="ex-ray"
            d={step === 2 ? "M410 125 270 178" : "M510 65 270 178"}
          />
          <path
            className="ex-terrain"
            d="M0 225 90 200 160 210 235 178 310 194 380 150 430 180 500 170 640 205V260H0Z"
          />
          <g className="ex-observer">
            <path d="M270 178v-27m-8 8h16" />
            <circle cx="270" cy="145" r="5" />
          </g>
          <rect
            className="ex-original"
            x="42"
            y="28"
            width="125"
            height="66"
            rx="4"
          />
          <text x="56" y="53">
            Original arrival
          </text>
          <text x="56" y="76">
            Day 1
          </text>
          <g className="ex-delayed">
            <rect x="192" y="28" width="125" height="66" rx="4" />
            <text x="206" y="53">
              Delayed arrival
            </text>
            <text x="206" y="76">
              Day 8
            </text>
          </g>
        </svg>
        <div className="explainer-copy" key={step}>
          <span className="explainer-count">
            {String(step + 1).padStart(2, "0")} / 04
          </span>
          <h3>{current.title}</h3>
          <p>{current.text}</p>
          <button onClick={() => onOpen?.(current.route)}>
            {current.action} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div
        className="explainer-steps"
        role="group"
        aria-label="Walkthrough step"
      >
        {steps.map((s, i) => (
          <button
            key={s.title}
            aria-pressed={i === step}
            onClick={() => {
              setPlaying(false);
              setStep(i);
            }}
          >
            <span>{i + 1}</span>
            {s.title}
          </button>
        ))}
      </div>
      <p className="caption">
        Original 2D illustration. Use the actual tools at any step. No autoplay,
        sound or external video service.
      </p>
    </section>
  );
}
