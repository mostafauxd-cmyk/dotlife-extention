import type { CalendarEvent, EventRule, Provenance } from "../types";

/**
 * مناسبت‌های پرطرفدار — popular Gregorian days people in Iran keep and shops advertise (2026-10-18, the
 * owner: «ولنتاین، هالووین، بلک فرایدی… جزو دیفالت‌ها»). Inside the app and on by default, like the
 * official holidays and the Iranian festivals. Ids are the ones these days had in «روزهای جهانی».
 */

const COMMON: Provenance = {
  source: "Widely observed Gregorian dates (Wikipedia)",
  url: "https://en.wikipedia.org/wiki/List_of_observances_set_by_the_Gregorian_calendar",
  retrievedAt: "2026-10-18",
};

/** Checked: 2026-11-27, 2027-11-26, 2028-11-24 (the article's own list). */
const BLACK_FRIDAY: Provenance = {
  source: "Black Friday — the Friday after U.S. Thanksgiving (4th Thursday of November), Wikipedia",
  url: "https://en.wikipedia.org/wiki/Black_Friday_(shopping)",
  retrievedAt: "2026-10-18",
};

const day = (month: number, d: number): EventRule => ({
  kind: "fixed",
  calendar: "gregorian",
  month,
  day: d,
});

const ev = (
  id: string,
  title: string,
  rule: EventRule,
  provenance: Provenance = COMMON,
): CalendarEvent => ({ id, pack: "popular", title, holiday: false, rule, provenance });

export const POPULAR_EVENTS: readonly CalendarEvent[] = [
  ev("new-year-gregorian", "آغاز سال نو میلادی", day(1, 1)),
  ev("valentines-day", "روز ولنتاین (روز عشق)", day(2, 14)),
  ev("april-fools-day", "روز شوخی (اول آوریل)", day(4, 1)),
  ev("halloween", "هالووین", day(10, 31)),
  ev(
    "black-friday",
    "بلک فرایدی (جمعه‌ی سیاه)",
    // the day after the 4th Thursday of November (Saturday = 0, so Thursday = 5)
    {
      kind: "nth-weekday-of-month",
      calendar: "gregorian",
      month: 11,
      weekday: 5,
      n: 4,
      offsetDays: 1,
    },
    BLACK_FRIDAY,
  ),
  ev("christmas", "کریسمس (میلاد مسیح)", day(12, 25)),
  ev("new-years-eve", "شب سال نو میلادی", day(12, 31)),
];
