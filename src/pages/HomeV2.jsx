import HorizonLedger from "../components/HorizonLedger.jsx";

export default function HomeV2({
  dataset,
  onExperiment,
  onStart,
  onTour,
  onReplayOpening,
}) {
  return (
    <main id="main" tabIndex={-1} className="home home-v2">
      <section className="home-intro hl-hero" data-tour="purpose">
        <div className="home-copy">
          <p className="home-story-kicker">
            A question about time, terrain and the low polar Sun
          </p>
          <h1>
            Land a week late,
            <br />
            and the ridge <span>may take the Sun.</span>
          </h1>
          <p className="lead">
            Near the Moon’s south pole the Sun circles just above the horizon.
            Arrive on a different day and it meets a different part of the
            hills. Lunar Navigator measures that change for six study points,
            five observer heights and any arrival date in the computed period:
            how long the Sun and Earth stay in view.
          </p>
        </div>
        <HorizonLedger dataset={dataset} onOpen={onExperiment} />
        <div className="home-start">
          <div className="home-actions">
            <a className="button" href="#/compare">
              Compare a landing delay
              <small>Choose the place, height, date and delay</small>
            </a>
            <button
              className="button secondary"
              onClick={() => onStart("faithful")}
            >
              Open the simulator
              <small>Fly the terrain and watch the sky in 3D</small>
            </button>
          </div>
          <div className="home-help">
            <button className="text-action" onClick={() => onStart("free")}>
              Free experiment · freeze individual motions
            </button>
            <button onClick={onTour} data-tour-start>
              Show me how · interactive tour
            </button>
            <a href="#/learn">How it works</a>
            <button onClick={onReplayOpening}>Replay the opening</button>
          </div>
          <p className="home-scope">
            For learning and comparing lunar conditions.{" "}
            {dataset?.manifest?.sites.length ?? 6} points on published
            south-pole terrain · dates shown in the computed dataset. This is
            not a certified landing plan.
          </p>
          <a className="quick-review" href="#/review">
            Just evaluating? Review the project in 3 minutes →
          </a>
        </div>
      </section>
      <section className="home-how">
        <div>
          <h2>
            From a question
            <br />
            to an explainable decision.
          </h2>
          <p>
            Start with a location, change the date and inspect the result. Every
            number leads back to its source.
          </p>
          <a href="#/learn">Learn with interactive examples →</a>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Choose a place and a time</h3>
              <p>
                Points on published south-pole terrain, with a defined study
                period.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Explore what the terrain hides</h3>
              <p>
                Switch between the Moon, local terrain and the sky at your
                selected point.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Compare, then check the evidence</h3>
              <p>
                See the trade-offs and understand where the model has limits.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <section className="home-audiences">
        <h2>Choose your way in.</h2>
        <div>
          <a href="#/mission">
            <strong>I’m curious.</strong>
            <span>A guided investigation, about 10 minutes.</span>
          </a>
          <a href="#/simulator">
            <strong>I want to experiment.</strong>
            <span>Open the 3D explorer with no locked stages.</span>
          </a>
          <a href="#/review">
            <strong>I’m reviewing the project.</strong>
            <span>Question, experiment and evidence in three minutes.</span>
          </a>
        </div>
      </section>
      <p className="caption home-scope">
        An educational research prototype for NASA Space Apps 2026. Useful for
        learning and early comparisons; not flight guidance, landing-safety
        certification or a radio-link guarantee.
      </p>
    </main>
  );
}
