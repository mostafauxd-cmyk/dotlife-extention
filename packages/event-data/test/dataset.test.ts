import { daysInMonth } from "@dotlife/calendar-core";
import { describe, expect, it } from "vitest";

import { ALL_PACKS, PACK_TITLES_FA } from "../src";
import { ALL_EVENTS } from "../src/all";

/** Dataset validator — every pack must pass these before it ships (PLAN §117 "maintain source provenance"). */
describe("event dataset", () => {
  it("ids are unique and kebab-case", () => {
    const ids = ALL_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("every event has a title and provenance with a retrieval date", () => {
    for (const e of ALL_EVENTS) {
      expect(e.title.trim().length, e.id).toBeGreaterThan(0);
      expect(e.provenance.source.trim().length, e.id).toBeGreaterThan(0);
      expect(e.provenance.retrievedAt, e.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("only the official-holidays pack may mark holidays, and all of it does", () => {
    for (const e of ALL_EVENTS) {
      expect(e.holiday, e.id).toBe(e.pack === "official-holidays");
    }
  });

  it("rules point at days that exist in their calendar", () => {
    for (const e of ALL_EVENTS) {
      const r = e.rule;
      expect(r.month, e.id).toBeGreaterThanOrEqual(1);
      expect(r.month, e.id).toBeLessThanOrEqual(12);
      if (r.kind === "fixed") {
        // longest possible month in that calendar
        const max = r.calendar === "hijri" ? 30 : daysInMonth(r.calendar, 1403, r.month);
        expect(r.day, e.id).toBeGreaterThanOrEqual(1);
        expect(r.day, e.id).toBeLessThanOrEqual(max);
        if (r.calendar === "hijri" && r.day === 30) {
          expect(r.clampToMonthEnd, `${e.id}: 30th of a Hijri month needs clampToMonthEnd`).toBe(
            true,
          );
        }
      }
    }
  });

  it("every pack has a Persian title and at least one event", () => {
    for (const pack of ALL_PACKS) {
      expect(PACK_TITLES_FA[pack].length).toBeGreaterThan(0);
      expect(ALL_EVENTS.filter((e) => e.pack === pack).length, pack).toBeGreaterThan(0);
    }
  });

  it("official holidays: 10 solar + 17 hijri rules", () => {
    const official = ALL_EVENTS.filter((e) => e.pack === "official-holidays");
    expect(official.filter((e) => e.rule.calendar === "solar-hijri").length).toBe(10);
    expect(official.filter((e) => e.rule.calendar === "hijri").length).toBe(17);
  });
});

describe("packs that share events", () => {
  it("alsoIn never repeats the event's own pack", () => {
    for (const e of ALL_EVENTS) {
      expect(e.alsoIn ?? [], e.id).not.toContain(e.pack);
      expect(new Set(e.alsoIn).size, e.id).toBe((e.alsoIn ?? []).length);
    }
  });
  it("only official holidays are holidays, so profession and health days never are", () => {
    for (const e of ALL_EVENTS.filter((x) => x.pack === "professions" || x.pack === "health")) {
      expect(e.holiday, e.id).toBe(false);
    }
  });
});
