import { ASTRONOMY_EVENTS } from "./packs/astronomy";
import { HEALTH_EVENTS } from "./packs/health";
import { INTERNATIONAL_EVENTS } from "./packs/international";
import { NATIONAL_EVENTS } from "./packs/national";
import { OFFICIAL_HOLIDAYS } from "./packs/official-holidays";
import { PERSIAN_CULTURAL_EVENTS } from "./packs/persian-cultural";
import { PROFESSION_EVENTS } from "./packs/professions";
import { RELIGIOUS_EVENTS } from "./packs/religious";
import type { CalendarEvent } from "./types";

/**
 * Every event of every pack (`@dotlife/event-data/all`): what the server publishes and the tests
 * check. The app never imports this — only the bundled packs ship inside it (PLAN step 16‌ب); the
 * others reach it as downloaded files (`registerPackFile`).
 */
export const ALL_EVENTS: readonly CalendarEvent[] = [
  ...OFFICIAL_HOLIDAYS,
  ...RELIGIOUS_EVENTS,
  ...NATIONAL_EVENTS,
  ...PERSIAN_CULTURAL_EVENTS,
  ...INTERNATIONAL_EVENTS,
  ...ASTRONOMY_EVENTS,
  ...PROFESSION_EVENTS,
  ...HEALTH_EVENTS,
];
