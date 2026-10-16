import type { Jdn } from "@dotlife/calendar-core";

import {
  isOfficialHoliday as isOfficialHolidayIn,
  isWeekend,
  occurrencesBetween as occurrencesBetweenIn,
  occurrencesInSolarMonth as occurrencesInSolarMonthIn,
  occurrencesOn as occurrencesOnIn,
  type EventQuery,
} from "./engine";
import { OFFICIAL_HOLIDAYS } from "./packs/official-holidays";
import { currentEvents } from "./registry";
import type { Occurrence, PackId } from "./types";

export type { CalendarEvent, EventRule, Occurrence, PackId, Provenance } from "./types";
export { ALL_PACKS } from "./types";
export { PACK_FILE_FORMAT, packFileOf, parsePackFile, type PackFile } from "./packFile";
export {
  BUNDLED_PACKS,
  currentEvents,
  eventsVersion,
  onEventsChange,
  registeredPacks,
  registerPackFile,
  resetRegistry,
  setPersonalEvents,
} from "./registry";
export type { EventQuery } from "./engine";
export { isWeekend };
export {
  hijriCorrection,
  isOfficialHijriKnown,
  officialHijri,
  officialHijriDaysInMonth,
  officialHijriStart,
  possibleHijriShift,
  setHijriCorrection,
  tableHijriStart,
} from "./hijri-official";
export type { HijriCorrection } from "./hijri-official";
export { HIJRI_MONTH_STARTS } from "./data/hijri-month-starts";

export const PACK_TITLES_FA: Readonly<Record<PackId, string>> = {
  "official-holidays": "تعطیلات رسمی ایران",
  religious: "مناسبت‌های مذهبی",
  national: "مناسبت‌های ملی، فرهنگی و ادبی",
  "persian-cultural": "جشن‌های ایرانی و ایران باستان",
  international: "روزهای جهانی",
  astronomy: "رویدادهای نجومی",
  professions: "روزهای مشاغل",
  health: "تقویم سلامت",
  personal: "مناسبت‌های من",
};

export function occurrencesBetween(from: Jdn, to: Jdn, query: EventQuery): Occurrence[] {
  return occurrencesBetweenIn(currentEvents(), from, to, query);
}

export function occurrencesOn(jdn: Jdn, query: EventQuery): Occurrence[] {
  return occurrencesOnIn(currentEvents(), jdn, query);
}

export function occurrencesInSolarMonth(
  year: number,
  month: number,
  query: EventQuery,
): Occurrence[] {
  return occurrencesInSolarMonthIn(currentEvents(), year, month, query);
}

/** Official public holiday (not counting Fridays). */
export function isOfficialHoliday(jdn: Jdn): boolean {
  return isOfficialHolidayIn(OFFICIAL_HOLIDAYS, jdn);
}

/** Official holiday or Friday. */
export function isDayOff(jdn: Jdn): boolean {
  return isWeekend(jdn) || isOfficialHoliday(jdn);
}
