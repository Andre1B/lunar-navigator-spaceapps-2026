import { useEffect } from "react";

// Finite, visible section entrances and control feedback. Live readings never animate.
export function usePageMotion(route) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations = new Set();
    const seen = new WeakSet();
    let frame = 0;
    const track = (animation) => {
      animations.add(animation);
      animation.onfinish = () => animations.delete(animation);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        let stagger = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          track(
            entry.target.animate(
              [
                { transform: "translateY(20px)" },
                { transform: "translateY(0)" },
              ],
              {
                duration: 650,
                delay: Math.min(stagger++ * 75, 300),
                easing: "cubic-bezier(.2,.7,.2,1)",
                fill: "none",
              },
            ),
          );
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 },
    );
    const observeNewSections = () => {
      frame = 0;
      const selector =
        route === "simulator"
          ? ".explorer-heading, .explorer-first-steps, .explorer-setup .panel-title"
          : "main h1, main > section, .home-copy > p, .home-actions, .delay-briefing, .chapter-list li, .page-heading, .answer-scenario, .review-layout > section, .learn-section, .credit-list > div";
      const candidates = [...document.querySelectorAll(selector)];
      // One animated ancestor per text block. Nested transforms/opacity caused
      // double travel and compositing changes on the same words.
      candidates
        .filter(
          (node) =>
            !seen.has(node) &&
            !candidates.some(
              (parent) => parent !== node && parent.contains(node),
            ),
        )
        .forEach((node) => {
          seen.add(node);
          observer.observe(node);
        });
    };
    frame = requestAnimationFrame(observeNewSections);
    // Dataset-backed sections arrive after the first paint. Observe new DOM
    // structure only, never the continuously changing text/attributes.
    const additions = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(observeNewSections);
    });
    const main = document.querySelector("main");
    if (main) additions.observe(main, { childList: true, subtree: true });
    const feedback = (event) => {
      const control = event.target.closest?.(
        "button:not(:disabled), a[href], summary",
      );
      if (
        !control ||
        control.closest(".space-canvas") ||
        matchMedia("(prefers-reduced-motion:reduce)").matches
      )
        return;
      const a = control.animate(
        [
          { boxShadow: "0 0 0 0 rgba(100,175,245,.42)" },
          { boxShadow: "0 0 0 6px rgba(100,175,245,0)" },
        ],
        { duration: 480, easing: "ease-out" },
      );
      track(a);
    };
    document.addEventListener("click", feedback);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      additions.disconnect();
      document.removeEventListener("click", feedback);
      animations.forEach((a) => a.cancel());
    };
  }, [route]);
}
