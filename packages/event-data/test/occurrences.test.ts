import { toJdn, type CalendarDate } from "@dotlife/calendar-core";
import { beforeAll, describe, expect, it } from "vitest";

import {
  ALL_PACKS,
  isDayOff,
  isOfficialHoliday,
  occurrencesInSolarMonth,
  occurrencesOn,
  packFileOf,
  registerPackFile,
} from "../src";
import { ALL_EVENTS } from "../src/all";

// every pack, as if all were downloaded
beforeAll(() => {
  for (const pack of ALL_PACKS) registerPackFile(packFileOf(pack, ALL_EVENTS));
});

const j = (year: number, month: number, day: number): number =>
  toJdn({ calendar: "solar-hijri", year, month, day });
const g = (year: number, month: number, day: number): number =>
  toJdn({ calendar: "gregorian", year, month, day });

const idsOn = (jdn: number, packs = ALL_PACKS): string[] =>
  occurrencesOn(jdn, { packs }).map((o) => o.event.id);

describe("solar-anchored events", () => {
  it("Nowruz 1405 = 2026-03-21, holiday", () => {
    expect(j(1405, 1, 1)).toBe(g(2026, 3, 21));
    expect(idsOn(j(1405, 1, 1))).toContain("nowruz-1");
    expect(isOfficialHoliday(j(1405, 1, 1))).toBe(true);
  });
  it("Hafez day 20 Mehr, not a holiday", () => {
    expect(idsOn(j(1405, 7, 20))).toContain("hafez-day");
    expect(isOfficialHoliday(j(1405, 7, 20))).toBe(false);
  });
  it("Chaharshanbe Suri = eve of the last Wednesday of the year", () => {
    // 1403: last Wednesday is 29 Esfand → Tuesday 28 Esfand (2025-03-18)
    expect(idsOn(j(1403, 12, 28))).toContain("chaharshanbe-suri");
    expect(idsOn(j(1403, 12, 21))).not.toContain("chaharshanbe-suri");
    expect(j(1403, 12, 28)).toBe(g(2025, 3, 18));
    // 1404: 29 Esfand is a Friday, last Wednesday is 27 Esfand → Tuesday 26 Esfand 1404 (2026-03-17)
    expect(idsOn(j(1404, 12, 26))).toContain("chaharshanbe-suri");
    expect(j(1404, 12, 26)).toBe(g(2026, 3, 17));
    expect(idsOn(j(1404, 12, 28))).not.toContain("chaharshanbe-suri");
  });
});

describe("hijri-anchored events use the official (observational) calendar", () => {
  // Dates below are what time.ir shows for these occasions.
  it("Ashura 1447 = 15 Tir 1404 (2025-07-06)", () => {
    expect(idsOn(g(2025, 7, 6))).toContain("ashura");
    expect(isOfficialHoliday(g(2025, 7, 6))).toBe(true);
  });
  it("Eid al-Fitr 1446 = 11 Farvardin 1404 (2025-03-31) and the day after", () => {
    expect(idsOn(g(2025, 3, 31))).toContain("eid-fitr-1");
    expect(idsOn(g(2025, 4, 1))).toContain("eid-fitr-2");
  });
  it("Quds Day 1404 = last Friday of Ramadan 1446 = 2025-03-28", () => {
    expect(idsOn(g(2025, 3, 28))).toContain("quds-day");
    expect(idsOn(g(2025, 3, 21))).not.toContain("quds-day");
  });
  it("Imam Reza martyrdom clamps to 29 Safar when Safar is short", () => {
    // Safar 1447 (official) ended on 29 Safar = 2025-08-24
    const ids = idsOn(g(2025, 8, 24));
    expect(ids).toContain("imam-reza-martyrdom");
  });
});

describe("queries", () => {
  it("packs filter visibility without touching data", () => {
    const jdn = j(1405, 1, 1);
    // 1 Farvardin 1405 is also 2 Shawwal 1447 (second day of Eid al-Fitr) — both are official holidays
    expect(idsOn(jdn, ["official-holidays"]).sort()).toEqual(["eid-fitr-2", "nowruz-1"]);
    expect(idsOn(jdn, ["persian-cultural"])).toEqual(["nowruz-festival"]);
    expect(idsOn(jdn, ["astronomy"])).toEqual(["vernal-equinox"]);
    expect(idsOn(jdn, [])).toEqual([]);
  });
  it("month query returns occurrences in day order with Solar Hijri dates", () => {
    const occ = occurrencesInSolarMonth(1405, 7, { packs: ["national", "official-holidays"] });
    const days = occ.map((o) => o.date.day);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
    for (const o of occ) {
      const d: CalendarDate = o.date;
      expect(d.calendar).toBe("solar-hijri");
      expect(d.month).toBe(7);
    }
    expect(occ.map((o) => o.event.id)).toContain("hafez-day");
  });
  it("isDayOff: Fridays and official holidays", () => {
    expect(isDayOff(j(1405, 7, 17))).toBe(true); // Friday
    expect(isDayOff(j(1405, 7, 12))).toBe(false); // Sunday, no holiday
    expect(isDayOff(j(1405, 1, 13))).toBe(true); // Sizdah-bedar
  });
});

describe("profession and health days (checked against time.ir 1405)", () => {
  const prof = ["professions"] as const;
  const health = ["health"] as const;
  it("solar profession days land on their official day", () => {
    expect(idsOn(j(1405, 6, 1), prof)).toContain("physicians-day");
    expect(idsOn(j(1405, 9, 15), prof)).toContain("accountants-day");
    expect(idsOn(j(1405, 12, 5), prof)).toContain("engineers-day");
    expect(idsOn(j(1405, 7, 7), prof)).toContain("firefighters-day");
    expect(idsOn(j(1405, 12, 7), prof)).toContain("lawyers-day");
  });
  it("Nurses' Day 1405 = 5 Jumada al-Ula 1448 = 24 Mehr 1405", () => {
    expect(idsOn(j(1405, 7, 24), prof)).toContain("nurses-day");
    expect(idsOn(j(1405, 7, 24), health)).toContain("nurses-day");
  });
  it("World Customs Day = 6 Bahman, World Diabetes Day = 23 Aban, World AIDS Day = 10 Azar (1405)", () => {
    expect(idsOn(j(1405, 11, 6), prof)).toContain("customs-day");
    expect(idsOn(j(1405, 8, 23), health)).toContain("world-diabetes-day");
    expect(idsOn(j(1405, 9, 10), health)).toContain("world-aids-day");
    expect(idsOn(j(1405, 3, 10), health)).toContain("world-no-tobacco-day");
    expect(idsOn(j(1405, 3, 24), health)).toContain("world-blood-donor-day");
  });
  it("a shared event shows once when both its packs are on", () => {
    const ids = idsOn(j(1405, 6, 1), ["professions", "health"]);
    expect(ids.filter((id) => id === "physicians-day")).toHaveLength(1);
  });
  it("national users keep the profession days they had", () => {
    expect(idsOn(j(1405, 2, 12), ["national"])).toContain("teachers-day");
    expect(idsOn(j(1405, 5, 17), ["national"])).toContain("journalists-day");
  });
  it("World Health Day = 18 Farvardin, in the health calendar too", () => {
    expect(idsOn(j(1405, 1, 18), health)).toContain("world-health-day");
  });
});
