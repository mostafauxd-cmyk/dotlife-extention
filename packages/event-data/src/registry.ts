import { OFFICIAL_HOLIDAYS } from "./packs/official-holidays";
import { PERSIAN_CULTURAL_EVENTS } from "./packs/persian-cultural";
import type { PackFile } from "./packFile";
import type { CalendarEvent, PackId } from "./types";

/**
 * The events the app knows right now (PLAN step 16‌ب): the packs inside the app, plus every pack
 * file downloaded so far. Visibility is still decided by the query (PLAN §125) — a pack that is
 * here but switched off shows nothing.
 */

/** The packs that ship inside the app; every other pack is downloaded when switched on. */
export const BUNDLED_PACKS: readonly PackId[] = ["official-holidays", "persian-cultural"];

const BUNDLED: readonly CalendarEvent[] = [...OFFICIAL_HOLIDAYS, ...PERSIAN_CULTURAL_EVENTS];

let files = new Map<PackId, readonly CalendarEvent[]>();
let personal: readonly CalendarEvent[] = [];
let current: readonly CalendarEvent[] = BUNDLED;
let version = 0;
const listeners = new Set<() => void>();

function rebuild(): void {
  // one copy per id: an event listed in several packs arrives in each of their files
  const seen = new Set(BUNDLED.map((e) => e.id));
  const out = [...BUNDLED];
  for (const events of files.values()) {
    for (const e of events) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  current = personal.length === 0 ? out : [...out, ...personal];
  version++;
  for (const l of listeners) l();
}

export function currentEvents(): readonly CalendarEvent[] {
  return current;
}

/** Changes whenever a pack arrives or is replaced: a cheap key for memoised views. */
export function eventsVersion(): number {
  return version;
}

/** Add a downloaded pack, or replace its earlier version. A bundled pack's file is ignored. */
export function registerPackFile(file: PackFile): void {
  if (BUNDLED_PACKS.includes(file.pack)) return;
  files = new Map(files).set(file.pack, file.events);
  rebuild();
}

/**
 * The user's own occasions (pack `personal`), all of them each time: they come from the phone's
 * store, not from a file.
 */
export function setPersonalEvents(events: readonly CalendarEvent[]): void {
  if (events === personal || (events.length === 0 && personal.length === 0)) return;
  personal = events;
  rebuild();
}

/** The downloaded packs known now. */
export function registeredPacks(): PackId[] {
  return [...files.keys()];
}

export function onEventsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Back to only the bundled packs (tests). */
export function resetRegistry(): void {
  files = new Map();
  personal = [];
  rebuild();
}
