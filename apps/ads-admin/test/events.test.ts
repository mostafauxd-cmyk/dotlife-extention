import { describe, expect, it } from "vitest";

import {
  ctr,
  demoEvents,
  LocalEventsStore,
  sinceDay,
  summarize,
  type StatRow,
} from "../src/data/events";
import { MemoryStorage } from "../src/data/store";
import { makeAd, NOW } from "./helpers";

const row = (over: Partial<StatRow>): StatRow => ({
  day: "2026-10-17",
  product: "newtab",
  slot: 6,
  ad: "a",
  impressions: 0,
  clicks: 0,
  ...over,
});

describe("LocalEventsStore", () => {
  it("adds counts to the day's total instead of keeping each showing", async () => {
    const s = new LocalEventsStore(new MemoryStorage());
    const e = { ad: "a", slot: 6, product: "newtab", day: "2026-10-17" } as const;
    await s.record({ ...e, kind: "impression" });
    await s.record({ ...e, kind: "impression", count: 9 });
    await s.record({ ...e, kind: "click" });
    await s.record({ ...e, kind: "click", day: "2026-10-16" });
    const rows = await s.stats();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.day === "2026-10-17")).toMatchObject({ impressions: 10, clicks: 1 });
  });
  it("clears, and tells listeners", async () => {
    const s = new LocalEventsStore(new MemoryStorage());
    let calls = 0;
    s.subscribe(() => calls++);
    await s.record({ ad: "a", slot: 1, product: "paket", kind: "click" });
    await s.clear();
    expect(await s.stats()).toEqual([]);
    expect(calls).toBe(2);
  });
});

describe("summarize", () => {
  const rows = [
    row({ impressions: 1000, clicks: 20 }),
    row({ slot: 4, ad: "b", impressions: 500, clicks: 5 }),
    row({ product: "paket", slot: 10, ad: "c", impressions: 200, clicks: 40 }),
    row({ day: "2026-09-01", impressions: 100, clicks: 1 }),
  ];
  it("totals by slot and by ad, the busiest first", () => {
    const s = summarize(rows, { product: "all" });
    expect(s.total).toEqual({ impressions: 1800, clicks: 66 });
    expect(s.bySlot.get(6)).toEqual({ impressions: 1100, clicks: 21 });
    expect(s.byAd.map((a) => a.ad)).toEqual(["a", "b", "c"]);
  });
  it("keeps to one product, and to the days since", () => {
    expect(summarize(rows, { product: "paket" }).total).toEqual({ impressions: 200, clicks: 40 });
    expect(summarize(rows, { product: "newtab", since: "2026-10-01" }).total).toEqual({
      impressions: 1500,
      clicks: 25,
    });
    expect(summarize(rows, { product: "noghte" }).total).toEqual({ impressions: 0, clicks: 0 });
  });
  it("computes a click-through rate, zero when nothing was shown", () => {
    expect(ctr({ impressions: 1000, clicks: 25 })).toBeCloseTo(0.025);
    expect(ctr({ impressions: 0, clicks: 0 })).toBe(0);
  });
  it("counts the last N days on the Tehran calendar", () => {
    expect(sinceDay(NOW, 7)).toBe("2026-10-11");
    expect(sinceDay(NOW, 1)).toBe("2026-10-17");
  });
});

describe("demoEvents", () => {
  it("is the same every time for the same ads", () => {
    const ads = [makeAd({ id: "a" }), makeAd({ id: "b", products: ["newtab", "paket"] })];
    expect(demoEvents(ads, NOW)).toEqual(demoEvents(ads, NOW));
    const e = demoEvents(ads, NOW, 3);
    expect(e).toHaveLength(2 * 3 * (1 + 2));
    expect(e.every((x) => (x.count ?? 0) >= 0)).toBe(true);
  });
});
