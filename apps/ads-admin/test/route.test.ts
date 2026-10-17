import { describe, expect, it } from "vitest";

import { adsHash, editHash, newAdHash, parseRoute } from "../src/data/route";

describe("routes", () => {
  it("opens the slots by default", () => {
    expect(parseRoute("")).toEqual({ page: "slots" });
    expect(parseRoute("#/nowhere")).toEqual({ page: "slots" });
  });
  it("reads the ads filter from the query", () => {
    const r = parseRoute("#/ads?slot=7&status=live&product=newtab&q=%D9%82%D8%B7%D8%A7%D8%B1");
    expect(r).toEqual({
      page: "ads",
      filter: { slot: 7, phase: "live", product: "newtab", advertiser: undefined, q: "قطار" },
    });
  });
  it("ignores a slot, status or product that does not exist", () => {
    const r = parseRoute("#/ads?slot=99&status=zzz&product=zzz");
    expect(r).toMatchObject({
      page: "ads",
      filter: { slot: undefined, phase: undefined, product: undefined },
    });
  });
  it("round-trips a filter", () => {
    const filter = { slot: 3, phase: "paused" as const, q: "بیمه" };
    expect(parseRoute(adsHash(filter))).toMatchObject({ page: "ads", filter });
    expect(adsHash({})).toBe("#/ads");
  });
  it("opens the form for a new ad or an existing one", () => {
    expect(parseRoute(newAdHash(7))).toEqual({ page: "ad", id: "new", slot: 7 });
    expect(parseRoute(newAdHash())).toEqual({ page: "ad", id: "new", slot: undefined });
    expect(parseRoute(editHash("ad-1/x"))).toEqual({ page: "ad", id: "ad-1/x", slot: undefined });
  });
  it("knows the other pages", () => {
    expect(parseRoute("#/publish")).toEqual({ page: "publish" });
    expect(parseRoute("#/dashboard")).toEqual({ page: "dashboard" });
  });
});
