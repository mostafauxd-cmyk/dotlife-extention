import { ALL_PACKS, type CalendarEvent, type PackId } from "./types";

/**
 * One pack as a downloadable file (PLAN step 16‌ب): the server publishes every pack this way, the app
 * keeps what it downloaded. An event listed in several packs (`alsoIn`) goes into each of their
 * files, so «روز پزشک» shows with only «تقویم سلامت» on; the app keeps one copy per id.
 */
export const PACK_FILE_FORMAT = 1;

export type PackFile = {
  format: typeof PACK_FILE_FORMAT;
  pack: PackId;
  events: CalendarEvent[];
};

export function packFileOf(pack: PackId, events: readonly CalendarEvent[]): PackFile {
  return {
    format: PACK_FILE_FORMAT,
    pack,
    events: events.filter((e) => e.pack === pack || e.alsoIn?.includes(pack) === true),
  };
}

const isPack = (x: unknown): x is PackId =>
  typeof x === "string" && ALL_PACKS.includes(x as PackId);
const isInt = (x: unknown, min: number, max: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const CALENDARS: readonly unknown[] = ["solar-hijri", "gregorian", "hijri"];

function isRule(r: unknown): boolean {
  if (r === null || typeof r !== "object") return false;
  const o = r as Record<string, unknown>;
  if (!CALENDARS.includes(o.calendar) || !isInt(o.month, 1, 12)) return false;
  if (o.kind === "fixed") {
    return (
      isInt(o.day, 1, 31) &&
      (o.clampToMonthEnd === undefined || typeof o.clampToMonthEnd === "boolean")
    );
  }
  if (o.kind === "last-weekday-of-month") {
    return isInt(o.weekday, 0, 6) && (o.offsetDays === undefined || isInt(o.offsetDays, -7, 7));
  }
  return false;
}

function isEvent(e: unknown): e is CalendarEvent {
  if (e === null || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  const p = o.provenance as Record<string, unknown> | null | undefined;
  return (
    typeof o.id === "string" &&
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.id) &&
    isPack(o.pack) &&
    typeof o.title === "string" &&
    o.title.trim() !== "" &&
    // a downloaded pack never makes a day off: only the bundled official holidays do
    o.holiday === false &&
    isRule(o.rule) &&
    (o.alsoIn === undefined || (Array.isArray(o.alsoIn) && o.alsoIn.every(isPack))) &&
    (o.description === undefined || typeof o.description === "string") &&
    typeof p === "object" &&
    p !== null &&
    typeof p.source === "string" &&
    typeof p.retrievedAt === "string"
  );
}

/**
 * A downloaded pack file, checked: a file from a newer format, with a broken event or for another
 * pack than expected is refused whole, never half used.
 */
export function parsePackFile(json: unknown, expected?: PackId): PackFile | null {
  if (json === null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.format !== PACK_FILE_FORMAT || !isPack(o.pack)) return null;
  if (expected !== undefined && o.pack !== expected) return null;
  if (!Array.isArray(o.events) || !o.events.every(isEvent)) return null;
  return { format: PACK_FILE_FORMAT, pack: o.pack, events: o.events };
}
