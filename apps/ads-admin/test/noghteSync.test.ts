import { describe, expect, it } from "vitest";

import type { PromoCard, PromoWrite } from "../src/data/noghtePromo";
import { isOurs, planPromoSync, type PromoRow } from "../src/data/noghteSync";
import { OCCASIONS } from "../src/data/occasions";

const card = (title: string): PromoCard => ({
  from: null,
  until: null,
  place: "top",
  look: "compact",
  title,
  text: null,
  label: null,
  image: null,
  action: null,
  tint: null,
  closable: true,
});
const write = (id: string): PromoWrite => ({ id, slot: "calendar", on: true, card: card(id) });
const row = (id: string, rank: number, on = true): PromoRow => ({
  id,
  slot: "calendar",
  rank,
  on,
  card: card(id),
});

describe("planPromoSync", () => {
  it("writes NX Ads' cards on, switches its old ones off, and leaves the panel's own alone", () => {
    const plan = planPromoSync(
      [write("nx-b"), write("nx-a")],
      [
        row("yalda", 0),
        row("nx-old", 1),
        row("nowruz", 2),
        row("nx-a", 3),
        row("nx-gone", 4, false),
      ],
    );
    expect(plan.puts.map((p) => [p.id, p.body.on])).toEqual([
      ["nx-b", true],
      ["nx-a", true],
      ["nx-old", false],
    ]);
    // ours first by share, then the hand-made ones as they were, then our old ones
    expect(plan.order).toEqual(["nx-b", "nx-a", "yalda", "nowruz", "nx-old", "nx-gone"]);
  });
  it("switches everything of ours off when nothing is published", () => {
    const plan = planPromoSync([], [row("nx-a", 0), row("x", 1)]);
    expect(plan.puts).toEqual([
      { id: "nx-a", body: { slot: "calendar", on: false, card: card("nx-a") } },
    ]);
    expect(isOurs("nx-a") && !isOurs("yalda")).toBe(true);
  });
});

describe("occasions", () => {
  it("lists the calendar's titles once each", () => {
    expect(OCCASIONS.length).toBeGreaterThan(50);
    expect(new Set(OCCASIONS).size).toBe(OCCASIONS.length);
  });
});
