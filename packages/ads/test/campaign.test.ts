import { describe, expect, it } from "vitest";

import {
  adSchema,
  allocate,
  campaignSchema,
  compileCampaigns,
  dailyBudget,
  estimateReach,
  NOGHTE_SLOTS,
  PAKET_SLOTS,
  pickAd,
  PLACEMENTS,
  PRODUCT_INFO,
  PRODUCTS,
  seasonOf,
  slotById,
  type Ad,
  type Campaign,
  type CampaignInput,
} from "../src";

const NOW = new Date("2026-10-17T09:00:00Z"); // Mehr: autumn

const campaign = (over: Partial<CampaignInput> = {}): Campaign =>
  campaignSchema.parse({
    id: "c1",
    name: "پاییز",
    advertiser: "الف",
    status: "live",
    model: "per-thousand",
    bid: 20000,
    budget: { total: 100_000_000 },
    products: [{ product: "newtab", slots: [6], targeting: {} }],
    ...over,
  });

const creative = (over: Partial<Ad> = {}): Ad =>
  adSchema.parse({
    id: "ad1",
    slot: 6,
    products: ["newtab"],
    status: "live",
    advertiser: "الف",
    title: "t",
    url: "https://example.com/",
    model: "per-thousand",
    campaign: "c1",
    ...over,
  });

const line = (f: ReturnType<typeof allocate>, campaignId: string, slot: number) =>
  f.places.find((p) => p.slot === slot)?.lines.find((l) => l.campaign === campaignId);

describe("catalog across products", () => {
  it("numbers each product's places from its own base, once each", () => {
    const ids = PLACEMENTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLACEMENTS) {
      const base = PRODUCT_INFO[p.product].slotBase;
      expect(p.id > base && p.id < base + 100, String(p.id)).toBe(true);
    }
    expect(NOGHTE_SLOTS.every((s) => s.product === "noghte")).toBe(true);
    expect(PAKET_SLOTS.every((s) => s.product === "paket")).toBe(true);
    expect(PRODUCTS.every((p) => PLACEMENTS.some((s) => s.product === p))).toBe(true);
  });
  it("offers Noghte only its two promo places, unaimed", () => {
    expect(NOGHTE_SLOTS.map((s) => s.id)).toEqual([101, 102]);
    for (const s of NOGHTE_SLOTS) expect(s.targets).toEqual([]);
  });
  it("never aims Paket by persona or anything of a person's money", () => {
    for (const s of PAKET_SLOTS) expect(s.targets).not.toContain("persona");
  });
  it("finds a place in any product", () => {
    expect(slotById(203)?.product).toBe("paket");
  });
});

describe("reach and budget", () => {
  const slot6 = slotById(6);
  if (slot6 === undefined) throw new Error("no slot");
  const t = campaignSchema.shape.products.element.shape.targeting.parse({});
  it("is everyone without targeting, less with it, and none outside the season", () => {
    expect(estimateReach(t, slot6, NOW)).toBe(1);
    expect(estimateReach({ ...t, city: ["تهران"] }, slot6, NOW)).toBeCloseTo(0.3);
    expect(estimateReach({ ...t, season: ["autumn"] }, slot6, NOW)).toBe(1);
    expect(estimateReach({ ...t, season: ["spring"] }, slot6, NOW)).toBe(0);
    // a dimension the place cannot be aimed by is ignored
    expect(estimateReach({ ...t, keyword: ["قطار"] }, slot6, NOW)).toBe(1);
  });
  it("reads the season on the Tehran calendar", () => {
    expect(seasonOf(NOW)).toBe("autumn");
    expect(seasonOf(new Date("2026-04-01T09:00:00Z"))).toBe("spring");
  });
  it("spreads the total over the days left, or keeps to the daily cap", () => {
    expect(dailyBudget(campaign({ budget: { total: 3_000_000 } }), NOW)).toBeCloseTo(100_000);
    const ending = campaign({ until: "2026-10-26", budget: { total: 1_000_000 } });
    expect(dailyBudget(ending, NOW)).toBeCloseTo(100_000, -3);
    expect(dailyBudget(campaign({ budget: { total: 9e9, daily: 50_000 } }), NOW)).toBe(50_000);
    expect(dailyBudget(campaign({ budget: { total: 100, daily: 50_000 }, spent: 100 }), NOW)).toBe(0);
  });
});

describe("allocate", () => {
  it("gives a lone campaign the whole place it can reach", () => {
    const f = allocate([campaign()], NOW);
    expect(line(f, "c1", 6)?.share).toBeCloseTo(1);
  });
  it("splits a place by the value of the bids", () => {
    const f = allocate(
      [campaign({ id: "a", bid: 30000 }), campaign({ id: "b", bid: 10000 })],
      NOW,
    );
    expect(line(f, "a", 6)?.share).toBeCloseTo(0.75);
    expect(line(f, "b", 6)?.share).toBeCloseTo(0.25);
    expect(line(f, "b", 6)?.limit).toBe("outbid");
  });
  it("ranks a click bid by its expected value per showing", () => {
    // 1000 toman a click at 1.2% is worth 12,000 a thousand, the same as a 12,000 CPM bid
    const f = allocate(
      [
        campaign({ id: "cpc", model: "per-click", bid: 1000 }),
        campaign({ id: "cpm", bid: 12000 }),
      ],
      NOW,
    );
    expect(line(f, "cpc", 6)?.share).toBeCloseTo(0.5);
  });
  it("holds a campaign to its daily budget and gives the rest to others", () => {
    // place 6 is seen ~30,000 times a day; at 20,000 a thousand the whole of it costs 600,000
    const poor = campaign({ id: "poor", bid: 40000, budget: { total: 9e9, daily: 120_000 } });
    const rich = campaign({ id: "rich", bid: 10000 });
    const f = allocate([poor, rich], NOW);
    const p = line(f, "poor", 6);
    expect(p?.limit).toBe("budget");
    expect(p?.spend).toBeLessThanOrEqual(120_000 + 1);
    expect(line(f, "rich", 6)?.share).toBeCloseTo(1 - (p?.share ?? 0));
    expect(f.campaigns.get("poor")?.spend).toBeLessThanOrEqual(120_000 + 1);
  });
  it("caps a targeted campaign at its reach and leaves the rest to others", () => {
    const tehran = campaign({
      id: "t",
      bid: 90000,
      products: [{ product: "newtab", slots: [6], targeting: { city: ["تهران"] } }],
    });
    const f = allocate([tehran, campaign({ id: "o", bid: 1000 })], NOW);
    expect(line(f, "t", 6)).toMatchObject({ limit: "reach" });
    expect(line(f, "t", 6)?.share).toBeCloseTo(0.3);
    expect(line(f, "o", 6)?.share).toBeCloseTo(0.7);
  });
  it("gives a sponsor the place outright, the best-paying one first", () => {
    const s1 = campaign({ id: "s1", model: "daily-sponsor", bid: 5_000_000, budget: { total: 9e9 } });
    const s2 = campaign({ id: "s2", model: "daily-sponsor", bid: 2_000_000, budget: { total: 9e9 } });
    const f = allocate([s2, s1, campaign({ id: "cpm" })], NOW);
    expect(line(f, "s1", 6)?.share).toBe(1);
    expect(line(f, "s2", 6)?.limit).toBe("exclusive");
    expect(line(f, "cpm", 6)?.share).toBe(0);
  });
  it("runs across products, each with its own places and targeting", () => {
    const multi = campaign({
      products: [
        { product: "newtab", slots: [6], targeting: { city: ["مشهد"] } },
        { product: "noghte", slots: [102], targeting: {} },
        { product: "paket", slots: [201], targeting: { topic: ["سفر"] } },
      ],
    });
    const f = allocate([multi], NOW);
    expect(f.places.map((p) => [p.slot, p.product])).toEqual([
      [6, "newtab"],
      [102, "noghte"],
      [201, "paket"],
    ]);
    // the app's promo places cannot be aimed, so they reach everyone
    expect(line(f, "c1", 102)?.reach).toBe(1);
  });
  it("leaves out campaigns that are paused or outside their days", () => {
    expect(allocate([campaign({ status: "paused" })], NOW).places).toEqual([]);
    expect(allocate([campaign({ from: "2026-11-01" })], NOW).places).toEqual([]);
  });
  it("ignores a place that belongs to another product", () => {
    const wrong = campaign({ products: [{ product: "paket", slots: [6], targeting: {} }] });
    expect(allocate([wrong], NOW).places).toEqual([]);
  });
});

describe("compileCampaigns", () => {
  it("writes the campaign's targeting, days, price and share onto its creatives", () => {
    const c = campaign({
      id: "c1",
      from: "2026-10-01",
      until: "2026-12-01",
      bid: 30000,
      products: [{ product: "newtab", slots: [6], targeting: { city: ["تهران"], keyword: ["x"] } }],
    });
    const [ad] = compileCampaigns([c], [creative()], NOW);
    expect(ad).toMatchObject({
      campaign: "c1",
      products: ["newtab"],
      from: "2026-10-01",
      until: "2026-12-01",
      price: 30000,
      share: 1,
      // keyword is not a dimension of place 6, so it is dropped
      targeting: { city: ["تهران"], keyword: [] },
    });
  });
  it("splits a line's share among its creatives", () => {
    const ads = compileCampaigns(
      [campaign({ id: "a", bid: 30000 }), campaign({ id: "b", bid: 10000 })],
      [
        creative({ id: "a1", campaign: "a" }),
        creative({ id: "a2", campaign: "a" }),
        creative({ id: "b1", campaign: "b" }),
      ],
      NOW,
    );
    expect(ads.map((a) => [a.id, a.share])).toEqual([
      ["a1", 0.375],
      ["a2", 0.375],
      ["b1", 0.25],
    ]);
  });
  it("drops creatives of stopped campaigns and drafts, and keeps ads outside campaigns", () => {
    const loose = creative({ id: "plain", campaign: undefined });
    const ads = compileCampaigns(
      [campaign({ status: "paused" })],
      [creative(), creative({ id: "d", status: "draft" }), loose],
      NOW,
    );
    expect(ads.map((a) => a.id)).toEqual(["plain"]);
  });
});

describe("pickAd by share", () => {
  const ctx = { product: "newtab" as const, now: NOW, consent: true };
  const a = creative({ id: "a", share: 0.6 });
  const b = creative({ id: "b", share: 0.3 });
  it("draws campaign ads in proportion to their share", () => {
    expect(pickAd([a, b], 6, { ...ctx, rand: () => 0.1 })?.id).toBe("a");
    expect(pickAd([a, b], 6, { ...ctx, rand: () => 0.7 })?.id).toBe("b");
  });
  it("leaves the unsold rest to ads outside campaigns, then to nothing", () => {
    const house = creative({ id: "house", campaign: undefined });
    expect(pickAd([a, b, house], 6, { ...ctx, rand: () => 0.95 })?.id).toBe("house");
    expect(pickAd([a, b], 6, { ...ctx, rand: () => 0.95 })).toBeNull();
  });
  it("normalises when shares add up to more than one", () => {
    const c = creative({ id: "c", share: 0.9 });
    const counts = { a: 0, c: 0 } as Record<string, number>;
    for (let i = 0; i < 100; i++) {
      const got = pickAd([a, c], 6, { ...ctx, rand: () => i / 100 });
      if (got !== null) counts[got.id] = (counts[got.id] ?? 0) + 1;
    }
    expect(counts["a"]! + counts["c"]!).toBe(100);
  });
});
