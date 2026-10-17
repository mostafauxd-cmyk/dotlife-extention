import { describe, expect, it } from "vitest";

import { promoId, toNoghtePromos } from "../src/data/noghtePromo";
import { PROMO_LOOK_LABEL } from "../src/data/slotForm";
import { makeAd } from "./helpers";

const promoAd = (over: Record<string, unknown> = {}) =>
  makeAd({ slot: 101, products: ["noghte"], model: "daily-sponsor", ...over });

describe("toNoghtePromos", () => {
  it("turns places 101 and 102 into the app's promo cards, the biggest share first", () => {
    const writes = toNoghtePromos([
      promoAd({ id: "A_1", share: 0.2, cta: "ببین", until: "2026-12-01" }),
      promoAd({ id: "b", slot: 102, share: 0.9, line: "متن", tint: "#3E7BFA" }),
      makeAd({ id: "newtab-only" }),
    ]);
    expect(writes.map((w) => [w.id, w.card.place])).toEqual([
      ["nx-b", "end"],
      ["nx-a_1", "top"],
    ]);
    expect(writes[1]?.card).toMatchObject({
      until: "2026-12-01",
      look: "compact",
      action: { title: "ببین", url: "https://example.com/" },
      label: "با همراهی ایران‌بلیت",
      closable: true,
    });
    expect(writes[0]?.card).toMatchObject({ text: "متن", tint: "#3E7BFA", action: null });
  });
  it("draws a picture card only with a sized picture", () => {
    const pic = { look: PROMO_LOOK_LABEL.picture, imageWidth: "1200", imageHeight: "800" };
    const [w] = toNoghtePromos([promoAd({ image: "https://example.com/a.jpg", extra: pic })]);
    expect(w?.card).toMatchObject({
      look: "picture",
      image: { url: "https://example.com/a.jpg", width: 1200, height: 800 },
    });
    const [noSize] = toNoghtePromos([
      promoAd({ image: "https://example.com/a.jpg", extra: { look: PROMO_LOOK_LABEL.picture } }),
    ]);
    expect(noSize?.card).toMatchObject({ look: "compact", image: null });
  });
  it("keeps to the app's limits and names", () => {
    const [w] = toNoghtePromos([promoAd({ title: "ب".repeat(80), cta: "د".repeat(30) })]);
    expect(w?.card.title).toHaveLength(60);
    expect(w?.card.action?.title).toHaveLength(24);
    expect(promoId("Ad Ü/1")).toMatch(/^[a-z0-9][a-z0-9._-]{0,60}$/);
  });
});
