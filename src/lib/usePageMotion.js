import { useEffect } from "react";

// Finite, visible section entrances and control feedback. Live readings never animate.
export function usePageMotion(route) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations = new Set();
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
                { opacity: 0.86, transform: "translateY(28px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              {
                duration: 850,
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
    const frame = requestAnimationFrame(() => {
      const selector =
        route === "simulator"
          ? ".explorer-heading, .explorer-first-steps, .explorer-setup .panel-title"
          : "main h1, main > section, .home-copy > p, .home-actions, .delay-briefing, .chapter-list li, .page-heading, .answer-scenario, .review-layout > section, .learn-section, .credit-list > div";
      document
        .querySelectorAll(selector)
        .forEach((node) => observer.observe(node));
    });
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
      document.removeEventListener("click", feedback);
      animations.forEach((a) => a.cancel());
    };
  }, [route]);
}
