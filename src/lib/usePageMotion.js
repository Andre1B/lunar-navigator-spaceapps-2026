import { useEffect } from "react";

// Finite entrance/scroll motion only. Never observe or animate live simulator text.
export function usePageMotion(route) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations = [];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          animations.push(
            entry.target.animate(
              [
                { opacity: 0.72, transform: "translateY(14px)" },
                { opacity: 1, transform: "translateY(0)" },
              ],
              {
                duration: 650,
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
          ? ".explorer-heading h1"
          : "main h1, main .home-section-intro, main section > h2, main .page-heading";
      document
        .querySelectorAll(selector)
        .forEach((node) => observer.observe(node));
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      animations.forEach((a) => a.cancel());
    };
  }, [route]);
}
