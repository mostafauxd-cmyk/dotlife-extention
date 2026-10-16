/** Calendar systems the app can display. Solar Hijri is always the primary one (PLAN §114). */
export type CalendarSystem = "solar-hijri" | "gregorian" | "hijri" | "shahanshahi";

/** A calendar date in a specific system. Months and days are 1-based. */
export type CalendarDate = {
  readonly calendar: CalendarSystem;
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

/** Year/month/day without the calendar tag, for internal algorithms. */
export type Ymd = { readonly year: number; readonly month: number; readonly day: number };

/**
 * Julian Day Number: the integer count of days since noon 1 January 4713 BC (proleptic Julian).
 * Every conversion in this package goes through JDN, so no calendar is converted to another directly.
 */
export type Jdn = number;

/** Day of week with Saturday = 0 … Friday = 6 — the Iranian week order. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
