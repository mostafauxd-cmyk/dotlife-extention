import { describe, expect, it } from "vitest";

import { DEFAULTS, orderedSlides, SLIDES } from "../src/settings";

describe("orderedSlides", () => {
  it("the design's order puts the news just before the networks", () => {
    expect(SLIDES.map(([id]) => id)).toEqual([
      "s-plans",
      "s-money",
      "s-notes",
      "s-news",
      "s-social",
    ]);
    expect(orderedSlides(DEFAULTS)).toEqual([
      "s-plans",
      "s-money",
      "s-notes",
      "s-news",
      "s-social",
    ]);
  });

  it("a slide the saved order lacks goes where the design has it, not last", () => {
    const saved = {
      ...DEFAULTS,
      slideOrder: ["s-plans", "s-money", "s-notes", "s-social"] as const,
    };
    expect(orderedSlides({ ...saved, slideOrder: [...saved.slideOrder] })).toEqual([
      "s-plans",
      "s-money",
      "s-notes",
      "s-news",
      "s-social",
    ]);
  });

  it("keeps the person's own order for the slides it knows, the new one beside its design neighbour", () => {
    const s = {
      ...DEFAULTS,
      slideOrder: ["s-social", "s-plans", "s-notes", "s-money"] as (
        "s-social" | "s-plans" | "s-notes" | "s-money"
      )[],
    };
    expect(orderedSlides(s)).toEqual(["s-news", "s-social", "s-plans", "s-notes", "s-money"]);
  });
});
