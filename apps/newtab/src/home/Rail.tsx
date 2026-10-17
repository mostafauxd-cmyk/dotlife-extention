import { useEffect, useState, type RefObject } from "react";

import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/icons";

/**
 * The slides' rail on the right edge, like the app's bottom bar: a few dots that say which slide is
 * in view; with the mouse over it, icons and names, and a click goes to that slide.
 */

export type SlideInfo = { id: string; icon: IconName; name: string };

export function Rail({
  slides,
  scroller,
}: {
  slides: readonly SlideInfo[];
  scroller: RefObject<HTMLDivElement | null>;
}) {
  const [current, setCurrent] = useState(slides[0]?.id ?? "");

  useEffect(() => {
    const root = scroller.current;
    if (root === null) return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(e.target.id);
      },
      { root, threshold: 0.6 },
    );
    for (const s of slides) {
      const el = document.getElementById(s.id);
      if (el !== null) seen.observe(el);
    }
    return () => {
      seen.disconnect();
    };
  }, [scroller, slides]);

  if (slides.length < 2) return null;
  return (
    <nav className="rail" aria-label="اسلایدها">
      {slides.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-current={current === s.id}
          aria-label={s.name}
          onClick={() => {
            document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <Icon name={s.icon} />
          <span className="tip">{s.name}</span>
        </button>
      ))}
    </nav>
  );
}
