import { describe, expect, it } from "vitest";

import { seasonOfMonth, traitsOf } from "../src/adTraits";
import { DEFAULTS } from "../src/settings";

describe("seasonOfMonth", () => {
  it("is spring for Farvardin–Khordad, summer Tir–Shahrivar, autumn Mehr–Azar, winter Dey–Esfand", () => {
    expect([1, 3, 4, 6, 7, 9, 10, 12].map(seasonOfMonth)).toEqual([
      "spring",
      "spring",
      "summer",
      "summer",
      "autumn",
      "autumn",
      "winter",
      "winter",
    ]);
  });
});

describe("traitsOf", () => {
  it("takes the city and topics the person chose, and the season and weekend from the date", () => {
    // Friday 17 Oct 2026 = 25 Mehr 1405
    const t = traitsOf(
      { ...DEFAULTS, city: "مشهد", topics: ["سفر"], persona: "dev" },
      new Date("2026-10-23T09:00:00Z"),
    );
    expect(t).toMatchObject({
      persona: "dev",
      city: "مشهد",
      topics: ["سفر"],
      season: "autumn",
      weekend: true,
    });
  });
  it("is not the weekend on a Saturday", () => {
    expect(traitsOf(DEFAULTS, new Date("2026-10-17T09:00:00Z")).weekend).toBe(false);
  });
});
