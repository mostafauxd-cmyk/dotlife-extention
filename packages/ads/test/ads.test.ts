import { describe, expect, it } from "vitest";

import {
  AD_PERSONAS,
  AD_SEASONS,
  adSchema,
  bundleSchema,
  inSchedule,
  pickAd,
  SAMPLE_ADS,
  SLOTS,
  tehranDay,
  type Ad,
  type AdContext,
} from "../src";

const NOW = new Date("2026-10-17T09:00:00Z");
const ctx = (over: Partial<AdContext> = {}): AdContext => ({
  product: "newtab",
  now: NOW,
  consent: true,
  ...over,
});
const ad = (over: Partial<Ad> = {}): Ad =>
  adSchema.parse({
    id: "a",
    slot: 6,
    products: ["newtab"],
    status: "live",
    advertiser: "x",
    title: "t",
    url: "https://example.com/",
    model: "per-thousand",
    ...over,
  });

describe("catalog", () => {
  it("has the design's fifteen slots, numbered", () => {
    expect(SLOTS.map((s) => s.id)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });
  it("never aims by what a person wrote or owns", () => {
    for (const s of SLOTS) expect(s.targets.every((t) => t !== undefined)).toBe(true);
  });
});

describe("the sample bundle", () => {
  it("is valid", () => {
    expect(bundleSchema.safeParse({ version: 0, generatedAt: "2026-10-17", ads: SAMPLE_ADS }).success).toBe(true);
  });
});

describe("schedule", () => {
  it("is on inside its days (Tehran), off outside, off when paused", () => {
    expect(inSchedule(ad({ from: "2026-10-17", until: "2026-10-17" }), NOW)).toBe(true);
    expect(inSchedule(ad({ from: "2026-10-18" }), NOW)).toBe(false);
    expect(inSchedule(ad({ until: "2026-10-16" }), NOW)).toBe(false);
    expect(inSchedule(ad({ status: "paused" }), NOW)).toBe(false);
  });
});

describe("pickAd", () => {
  it("shows nothing without consent", () => {
    expect(pickAd([ad()], 6, ctx({ consent: false }))).toBeNull();
  });
  it("takes the ad for the slot and product only", () => {
    expect(pickAd([ad({ slot: 7 })], 6, ctx())).toBeNull();
    expect(pickAd([ad({ products: ["paket"] })], 6, ctx())).toBeNull();
    expect(pickAd([ad()], 6, ctx())?.id).toBe("a");
  });
  it("aims by persona, city and the typed word", () => {
    const d = ad({ targeting: { persona: ["designer"], city: ["mashhad"], season: [], occasion: [], keyword: ["قطار"], topic: [], weekend: false } });
    expect(pickAd([d], 6, ctx({ persona: "designer", city: "mashhad", keyword: "بلیت قطار" }))).not.toBeNull();
    expect(pickAd([d], 6, ctx({ persona: "dev", city: "mashhad", keyword: "قطار" }))).toBeNull();
    expect(pickAd([d], 6, ctx({ persona: "designer", city: "mashhad" }))).toBeNull();
  });
  it("lets a Plus subscriber see only the partner's item (10)", () => {
    expect(pickAd([ad({ slot: 6 })], 6, ctx({ plus: true }))).toBeNull();
    expect(pickAd([ad({ slot: 10, model: "per-sale" })], 10, ctx({ plus: true }))).not.toBeNull();
  });
  it("fills at most three slots on a slide", () => {
    expect(pickAd([ad()], 6, ctx({ filledOnSlide: 3 }))).toBeNull();
    expect(pickAd([ad()], 6, ctx({ filledOnSlide: 2 }))).not.toBeNull();
  });
  it("prefers the heavier ad and skips a dismissed one", () => {
    const a = ad({ id: "a", weight: 1 });
    const b = ad({ id: "b", weight: 5 });
    expect(pickAd([a, b], 6, ctx())?.id).toBe("b");
    expect(pickAd([a, b], 6, ctx({ dismissed: new Set(["b"]) }))?.id).toBe("a");
  });
});

describe("vocabulary and days", () => {
  it("names each persona and season once", () => {
    expect(new Set(AD_PERSONAS.map((p) => p.id)).size).toBe(AD_PERSONAS.length);
    expect(AD_SEASONS.map((x) => x.id)).toEqual(["spring", "summer", "autumn", "winter"]);
  });
  it("reads a day on the Tehran clock", () => {
    // 21:00 UTC is already the next morning in Tehran (UTC+3:30)
    expect(tehranDay(new Date("2026-10-17T21:00:00Z"))).toBe("2026-10-18");
  });
});

describe("links", () => {
  const base = {
    id: "a",
    slot: 6,
    products: ["newtab"],
    status: "live",
    advertiser: "x",
    title: "t",
    model: "per-thousand",
  };
  it("takes only https links and pictures", () => {
    expect(adSchema.safeParse({ ...base, url: "https://example.com/a?b=1" }).success).toBe(true);
    for (const url of [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://example.com/",
      "https://",
    ])
      expect(adSchema.safeParse({ ...base, url }).success, url).toBe(false);
    expect(
      adSchema.safeParse({ ...base, url: "https://example.com/", image: "javascript:x" }).success,
    ).toBe(false);
  });
});
