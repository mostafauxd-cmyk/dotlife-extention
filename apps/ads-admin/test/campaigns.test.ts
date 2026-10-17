import { campaignSchema, type Campaign } from "@dotlife/ads";
import { describe, expect, it } from "vitest";

import { blankCampaign, campaignDraftFrom, validateCampaign } from "../src/data/campaignForm";
import { campaignStats } from "../src/data/events";
import {
  adPhase,
  buildBundle,
  campaignMap,
  campaignPhase,
  duplicateCampaign,
  parseImport,
} from "../src/data/logic";
import { parseRoute } from "../src/data/route";
import { SAMPLE_CAMPAIGNS, SAMPLE_CREATIVES } from "../src/data/samples";
import { LocalAdsStore, MemoryStorage } from "../src/data/store";
import { makeAd, NOW } from "./helpers";

const camp = (over: Record<string, unknown> = {}): Campaign =>
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

describe("campaign form", () => {
  const filled = () => {
    const d = blankCampaign("c9");
    d.name = "تور کیش";
    d.advertiser = "آژانس";
    d.bid = "25,000";
    d.total = "50000000";
    d.plans.paket = { ...d.plans.paket, on: true, slots: [201], topic: ["سفر"], city: ["تهران"] };
    return d;
  };
  it("accepts a filled draft and keeps only the targeting its places read", () => {
    const r = validateCampaign(filled());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.campaign.bid).toBe(25000);
      // place 201 is aimed by topic only, so the city is dropped
      expect(r.campaign.products.map((p) => [p.product, p.slots])).toEqual([["paket", [201]]]);
      expect(r.campaign.products[0]?.targeting).toMatchObject({ topic: ["سفر"], city: [] });
    }
  });
  it("says in Persian what is missing", () => {
    const r = validateCampaign(blankCampaign("x"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors["name"]).toBe("نام کمپین لازم است.");
      expect(r.errors["products"]).toBe("دست‌کم یک محصول را روشن کن.");
      expect(r.errors["bid"]).toBeDefined();
      expect(r.errors["total"]).toBeDefined();
    }
  });
  it("wants a place in every product that is on, and a daily cap under the total", () => {
    const d = filled();
    d.plans.noghte = { ...d.plans.noghte, on: true };
    d.daily = "90000000";
    const r = validateCampaign(d);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors["plan.noghte"]).toContain("اپ نقطه");
      expect(r.errors["daily"]).toContain("بیشتر");
    }
  });
  it("round-trips the sample campaigns", () => {
    for (const c of SAMPLE_CAMPAIGNS) {
      const r = validateCampaign(campaignDraftFrom(c));
      expect(r.ok && r.campaign).toEqual(c);
    }
  });
});

describe("campaigns in the panel's rules", () => {
  it("reads a campaign's phase from its status and days", () => {
    expect(campaignPhase(camp(), NOW)).toBe("live");
    expect(campaignPhase(camp({ from: "2026-11-01" }), NOW)).toBe("scheduled");
    expect(campaignPhase(camp({ until: "2026-10-01" }), NOW)).toBe("ended");
    expect(campaignPhase(camp({ status: "paused" }), NOW)).toBe("paused");
  });
  it("holds a creative to its campaign", () => {
    const ad = makeAd({ campaign: "c1" });
    expect(adPhase(ad, NOW, campaignMap([camp({ status: "paused" })]))).toBe("paused");
    expect(adPhase(ad, NOW, campaignMap([camp()]))).toBe("live");
    expect(adPhase(ad, NOW, campaignMap([]))).toBe("draft");
  });
  it("publishes creatives with their campaign's share, and leaves out a paused campaign's", () => {
    const ads = [makeAd({ id: "cr", campaign: "c1" }), makeAd({ id: "plain" })];
    const live = buildBundle(ads, 0, NOW, [camp()]);
    expect(live.ads.map((a) => [a.id, a.share])).toEqual([
      ["cr", 1],
      ["plain", undefined],
    ]);
    expect(buildBundle(ads, 0, NOW, [camp({ status: "paused" })]).ads.map((a) => a.id)).toEqual([
      "plain",
    ]);
  });
  it("copies a campaign as a draft without its spend", () => {
    const copy = duplicateCampaign(camp({ spent: 500 }), "c2");
    expect(copy).toMatchObject({ id: "c2", status: "draft", name: "پاییز (کپی)" });
    expect(copy.spent).toBeUndefined();
  });
  it("prices each campaign's counts by its model", () => {
    const rows = [
      {
        day: "2026-10-16",
        product: "newtab" as const,
        slot: 6,
        ad: "a",
        impressions: 2000,
        clicks: 30,
      },
      {
        day: "2026-10-17",
        product: "newtab" as const,
        slot: 6,
        ad: "a",
        impressions: 1000,
        clicks: 10,
      },
      {
        day: "2026-10-17",
        product: "paket" as const,
        slot: 203,
        ad: "b",
        impressions: 500,
        clicks: 20,
      },
    ];
    const ads = [
      makeAd({ id: "a", campaign: "cpm" }),
      makeAd({ id: "b", campaign: "cpc", slot: 203, products: ["paket"] }),
    ];
    const stats = campaignStats(
      rows,
      ads,
      [
        camp({ id: "cpm" }),
        camp({ id: "cpc", model: "per-click", bid: 1500 }),
        camp({ id: "none" }),
      ],
      {
        product: "all",
      },
    );
    expect(stats).toEqual([
      { campaign: "cpm", impressions: 3000, clicks: 40, spend: 60000 },
      { campaign: "cpc", impressions: 500, clicks: 20, spend: 30000 },
    ]);
    const sponsor = campaignStats(
      rows,
      ads,
      [camp({ id: "cpm", model: "daily-sponsor", bid: 1_000_000 })],
      { product: "newtab" },
    );
    expect(sponsor[0]?.spend).toBe(2_000_000);
  });
});

describe("campaign storage, routes and import", () => {
  it("keeps campaigns, seeds samples once, and deletes a campaign with its creatives", async () => {
    const storage = new MemoryStorage();
    const store = new LocalAdsStore({
      storage,
      seedCampaigns: { campaigns: SAMPLE_CAMPAIGNS, ads: SAMPLE_CREATIVES },
    });
    expect(await store.listCampaigns()).toHaveLength(SAMPLE_CAMPAIGNS.length);
    expect((await store.list()).filter((a) => a.campaign === "sample-c-travel")).toHaveLength(4);
    await store.deleteCampaign("sample-c-travel");
    expect((await store.list()).some((a) => a.campaign === "sample-c-travel")).toBe(false);
    const again = new LocalAdsStore({
      storage,
      seedCampaigns: { campaigns: SAMPLE_CAMPAIGNS, ads: SAMPLE_CREATIVES },
    });
    expect(await again.listCampaigns()).toHaveLength(SAMPLE_CAMPAIGNS.length - 1);
    await expect(store.putCampaign({ ...camp(), bid: -1 })).rejects.toThrow();
  });
  it("publishes through the campaigns", async () => {
    const store = new LocalAdsStore({ storage: new MemoryStorage() });
    await store.putCampaign(camp());
    await store.put(makeAd({ id: "cr", campaign: "c1" }));
    const b = await store.publish(NOW);
    expect(b.ads[0]).toMatchObject({ id: "cr", share: 1, price: 20000 });
  });
  it("routes to campaigns and to a new creative of one", () => {
    expect(parseRoute("#/campaigns")).toEqual({ page: "campaigns" });
    expect(parseRoute("#/campaigns/new")).toEqual({ page: "campaign", id: "new" });
    expect(parseRoute("#/campaigns/edit/c1")).toEqual({ page: "campaign", id: "c1" });
    expect(parseRoute("#/ads/new?slot=201&campaign=c1")).toEqual({
      page: "ad",
      id: "new",
      slot: 201,
      campaign: "c1",
    });
  });
  it("imports the campaigns of a full export", () => {
    const text = JSON.stringify({
      version: 2,
      generatedAt: NOW.toISOString(),
      ads: [makeAd()],
      campaigns: [camp()],
    });
    expect(parseImport(text)).toMatchObject({ ok: true, campaigns: [{ id: "c1" }] });
    const bad = JSON.stringify({
      version: 2,
      generatedAt: NOW.toISOString(),
      ads: [],
      campaigns: [{ id: 1 }],
    });
    expect(parseImport(bad)).toMatchObject({ ok: false });
  });
});
