import { describe, expect, it } from "vitest";

import { CITIES, findCities } from "../src/cities";

describe("cities", () => {
  it("has every province's capital and many more, once each", () => {
    expect(CITIES.length).toBeGreaterThan(120);
    expect(new Set(CITIES).size).toBe(CITIES.length);
    for (const c of ["تهران", "ایلام", "یاسوج", "بندر عباس", "گنبد کاووس", "کیش"])
      expect(CITIES).toContain(c);
  });
  it("finds by a few letters, starts first, Arabic letters and spaces ignored", () => {
    expect(findCities("كرم")).toEqual(["کرمان", "کرمانشاه"]);
    expect(findCities("بندرع")[0]).toBe("بندر عباس");
    expect(findCities("حیدریه")).toContain("تربت حیدریه");
    expect(findCities("  ")).toEqual([]);
  });
});
