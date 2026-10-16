import type { CalendarDate, CalendarSystem, Jdn, Weekday } from "@dotlife/calendar-core";

/** Event packs the user can switch on (PLAN §116–118). `official-holidays` is the core dataset. */
export type PackId =
  | "official-holidays"
  | "religious"
  | "national"
  | "persian-cultural"
  | "international"
  | "astronomy"
  | "professions"
  | "health"
  /**
   * The user's own occasions (2026-10-12: a birthday, a wedding anniversary): on the phone, never a
   * download, and always shown — not in `ALL_PACKS`, which lists the packs one can switch.
   */
  | "personal";

export const ALL_PACKS: readonly PackId[] = [
  "official-holidays",
  "religious",
  "national",
  "persian-cultural",
  "international",
  "astronomy",
  "professions",
  "health",
];

/** Calendars an event rule can be anchored to. Shahanshahi shares Solar Hijri months, so it is never used here. */
export type RuleCalendar = Exclude<CalendarSystem, "shahanshahi">;

export type EventRule =
  | {
      kind: "fixed";
      calendar: RuleCalendar;
      month: number;
      day: number;
      /**
       * For dates like 30 Safar that do not exist in short months: observe on the last day of the month
       * instead of skipping the year.
       */
      clampToMonthEnd?: boolean;
    }
  | {
      /** e.g. Quds Day = last Friday of Ramadan, Chaharshanbe Suri = last Tuesday of Esfand */
      kind: "last-weekday-of-month";
      calendar: RuleCalendar;
      month: number;
      weekday: Weekday;
      /** Shift the occurrence, e.g. -1 = the day before that weekday (Chaharshanbe Suri = eve of the last Wednesday). */
      offsetDays?: number;
    };

export type Provenance = {
  /** Human-readable source, Persian or English. */
  source: string;
  url?: string;
  /** ISO date the data was checked against the source. */
  retrievedAt: string;
};

export type CalendarEvent = {
  /** Stable, kebab-case, unique across all packs. Never reuse an id for a different event. */
  id: string;
  pack: PackId;
  title: string;
  /** Official public holiday in Iran (only events in `official-holidays` may set this). */
  holiday: boolean;
  rule: EventRule;
  /**
   * Other packs that list this event too, e.g. «روز پزشک» is both a profession day and a health day.
   * The event shows once when several of its packs are on, labelled with `pack`.
   */
  alsoIn?: readonly PackId[];
  /** Optional free text shown in the detail view. */
  description?: string;
  provenance: Provenance;
};

/** A concrete occurrence of an event on a specific day. */
export type Occurrence = {
  event: CalendarEvent;
  jdn: Jdn;
  /** The same day in Solar Hijri, for display. */
  date: CalendarDate;
};
