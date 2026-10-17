import { adSchema, type Ad } from "@dotlife/ads";

export const NOW = new Date("2026-10-17T09:00:00Z");

/** A valid ad for slot 6, with whatever the test changes. */
export const makeAd = (over: Record<string, unknown> = {}): Ad =>
  adSchema.parse({
    id: "a",
    slot: 6,
    products: ["newtab"],
    status: "live",
    advertiser: "ایران‌بلیت",
    title: "بلیت قطار",
    url: "https://example.com/",
    model: "per-thousand",
    ...over,
  });
