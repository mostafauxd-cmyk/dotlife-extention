import { fromJdn, weekdayOfJdn } from "@dotlife/calendar-core";
import { dateToJdn, localNow } from "@dotlife/tasks";

import { TIME_ZONE } from "./noghte/model";
import type { Settings } from "./settings";
import { occasionsOn } from "./today";

/**
 * What the ads may be aimed by, worked out here. The person's own words are the city and the topics
 * they chose in «شخصی‌سازی» (the persona too); the season, the weekend and today's occasions come
 * from the date alone. Nothing they wrote or own is read, and none of this leaves the device.
 */

export type Season = "spring" | "summer" | "autumn" | "winter";

/** Farvardin–Khordad is spring, Tir–Shahrivar summer, Mehr–Azar autumn, Dey–Esfand winter. */
export function seasonOfMonth(solarMonth: number): Season {
  if (solarMonth <= 3) return "spring";
  if (solarMonth <= 6) return "summer";
  if (solarMonth <= 9) return "autumn";
  return "winter";
}

export type Traits = {
  persona: string | null;
  city: string | null;
  season: Season;
  weekend: boolean;
  topics: string[];
  /** The titles of today's occasions, each one a thing a «زیر مناسبت» ad can be about. */
  occasions: string[];
};

export function traitsOf(s: Settings, now: Date = new Date()): Traits {
  const day = localNow(TIME_ZONE, now).date;
  const jdn = dateToJdn(day);
  // 0 = Saturday … 5 = Thursday, 6 = Friday
  const wd = weekdayOfJdn(jdn);
  return {
    persona: s.persona,
    city: s.city,
    season: seasonOfMonth(fromJdn(jdn, "solar-hijri").month),
    weekend: wd === 5 || wd === 6,
    topics: s.topics,
    occasions: occasionsOn(jdn).map((o) => o.event.title),
  };
}
