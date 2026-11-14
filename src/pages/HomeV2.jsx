export default function HomeV2({ onStart, onTour }) {
  return (
    <main id="main" tabIndex={-1} className="home home-v2">
      <section className="home-intro" data-tour="purpose">
        <div className="home-copy">
          <h1>
            Explore the Moon.
            <br />
            <span>See what a delay changes.</span>
          </h1>
          <p className="lead">
            Will there be sunlight? Can the location see Earth? What changes if
            arrival is delayed?
          </p>
          <p>
            See how lunar terrain and time change the answer. Explore a real
            sky, compare four south-pole locations and build a plan you can
            explain.
          </p>
          <div className="home-actions">
            <button className="button" onClick={() => onStart("faithful")}>
              Start a Faithful Mission{" "}
              <small>Guided investigation · about 10 minutes</small>
            </button>
            <button
              className="button secondary"
              onClick={() => onStart("free")}
            >
              Experiment in Free Mode{" "}
              <small>Open workspace · artificial freezes</small>
            </button>
          </div>
          <div className="home-help">
            <button onClick={onTour} data-tour-start>
              Show me how · interactive tour
            </button>
            <a href="#/learn">How it works</a>
          </div>
          <a className="quick-review" href="#/compare">
            Just evaluating? Open the comparison →
          </a>
        </div>
        <div className="home-moon">
          <div
            className="moon-disc"
            role="img"
            aria-label="LROC lunar imagery from NASA’s Scientific Visualization Studio"
          />
          <div className="home-orbit-note">
            <span className="sun-dot" />
            Sunlight
            <span className="earth-dot" />
            Earth visibility
          </div>
          <a className="scene-preview-link" href="#/simulator">
            Enter the 3D explorer →
          </a>
        </div>
      </section>
      <section className="home-questions" aria-label="What you can discover">
        <a href="#/simulator">
          <span className="feature-symbol sun-symbol" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
            </svg>
          </span>
          <h2>Follow the light.</h2>
          <p>Move time and see why a small ridge can hide the low polar Sun.</p>
          <span>Explore the moving sky →</span>
        </a>
        <a href="#/compare">
          <span className="feature-symbol earth-symbol" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="9" />
              <ellipse cx="12" cy="12" rx="4" ry="9" />
              <path d="M3 12h18M5 6.5h14M5 17.5h14" />
            </svg>
          </span>
          <h2>Keep Earth in view.</h2>
          <p>
            Discover where the terrain interrupts a direct view of our planet.
          </p>
          <span>Compare visibility windows →</span>
        </a>
        <a href="#/mission">
          <span className="feature-symbol delay-symbol" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M20 9a8 8 0 1 0 0 6M20 3v6h-6M12 7v5l3 2" />
            </svg>
          </span>
          <h2>Challenge the plan.</h2>
          <p>
            A landing is delayed. Keep your location or find an alternative.
          </p>
          <span>Take the guided mission →</span>
        </a>
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
                Four published south-pole points, with a clearly defined study
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
          <a href="#/compare">
            <strong>I’m reviewing the project.</strong>
            <span>Compare scenarios, then open the sources.</span>
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
