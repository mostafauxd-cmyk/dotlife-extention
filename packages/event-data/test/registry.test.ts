import { toJdn } from "@dotlife/calendar-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  ALL_PACKS,
  BUNDLED_PACKS,
  eventsVersion,
  occurrencesOn,
  onEventsChange,
  packFileOf,
  parsePackFile,
  registeredPacks,
  registerPackFile,
  resetRegistry,
} from "../src";
import { ALL_EVENTS } from "../src/all";

const day = (year: number, month: number, d: number) =>
  toJdn({ calendar: "solar-hijri", year, month, day: d });
const ids = (jdn: number) => occurrencesOn(jdn, { packs: ALL_PACKS }).map((o) => o.event.id);
const roundTrip = (pack: (typeof ALL_PACKS)[number]) =>
  JSON.parse(JSON.stringify(packFileOf(pack, ALL_EVENTS))) as unknown;

afterEach(() => {
  resetRegistry();
});

describe("registry", () => {
  it("knows only the bundled packs until others are downloaded", () => {
    expect(BUNDLED_PACKS).toEqual(["official-holidays", "persian-cultural"]);
    expect(ids(day(1405, 1, 1))).toContain("nowruz-1"); // official holiday
    expect(ids(day(1405, 7, 10))).toContain("mehregan"); // Persian festival
    expect(ids(day(1405, 7, 20))).not.toContain("hafez-day"); // national: not yet here
  });

  it("adds a downloaded pack, once, and tells listeners", () => {
    let heard = 0;
    const off = onEventsChange(() => heard++);
    const before = eventsVersion();
    const file = parsePackFile(roundTrip("national"), "national");
    expect(file).not.toBeNull();
    if (file === null) return;
    registerPackFile(file);
    registerPackFile(file); // a newer copy replaces, never doubles
    off();
    expect(ids(day(1405, 7, 20)).filter((id) => id === "hafez-day")).toHaveLength(1);
    expect(registeredPacks()).toEqual(["national"]);
    expect(eventsVersion()).toBeGreaterThan(before);
    expect(heard).toBe(2);
  });

  it("keeps one copy of an event listed in two downloaded packs", () => {
    for (const pack of ["professions", "health"] as const) {
      const f = parsePackFile(roundTrip(pack), pack);
      if (f !== null) registerPackFile(f);
    }
    const all = occurrencesOn(day(1405, 6, 1), { packs: ALL_PACKS }).map((o) => o.event.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("ignores a file for a bundled pack", () => {
    registerPackFile({ format: 1, pack: "persian-cultural", events: [] });
    expect(ids(day(1405, 7, 10))).toContain("mehregan");
  });
});

describe("parsePackFile", () => {
  it("accepts every pack the server publishes, except the bundled holidays", () => {
    for (const pack of ALL_PACKS) {
      const ok = parsePackFile(roundTrip(pack), pack) !== null;
      expect(ok, pack).toBe(pack !== "official-holidays");
    }
  });

  it("refuses a newer format, the wrong pack, and any broken event", () => {
    const good = roundTrip("religious") as { events: Record<string, unknown>[] };
    expect(parsePackFile({ ...good, format: 2 })).toBeNull();
    expect(parsePackFile(good, "health")).toBeNull();
    const broken = (patch: Record<string, unknown>) => ({
      ...good,
      events: [{ ...good.events[0], ...patch }, ...good.events.slice(1)],
    });
    expect(parsePackFile(broken({ title: " " }))).toBeNull();
    expect(parsePackFile(broken({ holiday: true }))).toBeNull();
    expect(
      parsePackFile(broken({ rule: { kind: "fixed", calendar: "hijri", month: 13, day: 1 } })),
    ).toBeNull();
    expect(parsePackFile(broken({ id: "Bad Id" }))).toBeNull();
    expect(parsePackFile("nope")).toBeNull();
  });
});
