import { ALL_EVENTS } from "@dotlife/event-data/all";

/**
 * The occasions an ad may be aimed by: the titles of the events in the packs the new tab reads
 * (apps/newtab/src/today.ts), which is exactly what a client sends as `occasion`.
 */
const PACKS = new Set([
  "official-holidays",
  "religious",
  "national",
  "persian-cultural",
  "international",
]);

export const OCCASIONS: readonly string[] = [
  ...new Set(ALL_EVENTS.filter((e) => PACKS.has(e.pack)).map((e) => e.title)),
].sort((a, b) => a.localeCompare(b, "fa"));
