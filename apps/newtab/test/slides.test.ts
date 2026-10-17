import { describe, expect, it } from "vitest";

import { DEFAULTS, orderedSlides, SLIDES } from "../src/settings";

describe("orderedSlides", () => {
  it("follows the design's order", () => {
    expect(SLIDES.map(([id]) => id)).toEqual(["s-plans", "s-money", "s-notes", "s-news"]);
    expect(orderedSlides(DEFAULTS)).toEqual(["s-plans", "s-money", "s-notes", "s-news"]);
  });

  it("a slide the saved order lacks goes where the design has it, not last", () => {
    const s = { ...DEFAULTS, slideOrder: ["s-plans", "s-notes", "s-news"] as const };
    expect(orderedSlides({ ...s, slideOrder: [...s.slideOrder] })).toEqual([
      "s-plans",
      "s-money",
      "s-notes",
      "s-news",
    ]);
  });

  it("keeps the person's own order for the slides it knows", () => {
    const s = { ...DEFAULTS, slideOrder: ["s-news", "s-plans", "s-notes", "s-money"] as const };
    expect(orderedSlides({ ...s, slideOrder: [...s.slideOrder] })).toEqual([
      "s-news",
      "s-plans",
      "s-notes",
      "s-money",
    ]);
  });

  it("drops a slide an older version saved and this one no longer has", () => {
    const s = {
      ...DEFAULTS,
      slideOrder: [
        "s-social",
        "s-plans",
        "s-money",
        "s-notes",
        "s-news",
      ] as unknown as typeof DEFAULTS.slideOrder,
    };
    expect(orderedSlides(s)).toEqual(["s-plans", "s-money", "s-notes", "s-news"]);
  });
});
