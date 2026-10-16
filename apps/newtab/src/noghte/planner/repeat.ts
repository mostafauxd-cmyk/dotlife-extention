// A copy of dotlife apps/mobile/src/planner/repeat.ts, so the extension edits tasks exactly as the app does. Keep the two in step.
import { fromJdn, MONTH_NAMES_FA, WEEKDAY_NAMES_FA } from "@dotlife/calendar-core";
import { dateToJdn, weekdayOf, type LocalDate, type Recurrence } from "@dotlife/tasks";

/**
 * The repeat menu of the event sheet (Cron's list, Persian and calendar-aware): months and years
 * follow the Solar Hijri calendar, the work week is Saturday–Wednesday.
 */

export type RepeatPreset = {
  id: string;
  label: string;
  /** Grey hint after the label, e.g. «پنج‌شنبه» or «۱۶ مهر». */
  hint?: string;
  recurrence?: Recurrence;
};

const ORDINALS = ["اولین", "دومین", "سومین", "چهارمین", "آخرین"] as const;

const base = (freq: Recurrence["freq"], interval = 1): Recurrence => ({
  freq,
  interval,
  calendar: "solar-hijri",
  end: { kind: "never" },
});

export function repeatPresets(date: LocalDate): RepeatPreset[] {
  const solar = fromJdn(dateToJdn(date), "solar-hijri");
  const wd = weekdayOf(date);
  const weekdayName = WEEKDAY_NAMES_FA[wd] ?? "";
  const monthName = MONTH_NAMES_FA["solar-hijri"][solar.month - 1] ?? "";
  const nth = ORDINALS[Math.min(4, Math.ceil(solar.day / 7) - 1)] ?? "";
  return [
    { id: "none", label: "تکرار نمی‌شود" },
    { id: "daily", label: "هر روز", recurrence: base("daily") },
    {
      id: "workdays",
      label: "هر روز کاری",
      hint: "شنبه تا چهارشنبه",
      recurrence: { ...base("weekly"), byWeekday: [0, 1, 2, 3, 4] },
    },
    {
      id: "weekly",
      label: "هر هفته",
      hint: weekdayName,
      recurrence: { ...base("weekly"), byWeekday: [wd] },
    },
    {
      id: "biweekly",
      label: "هر دو هفته",
      hint: weekdayName,
      recurrence: { ...base("weekly", 2), byWeekday: [wd] },
    },
    {
      id: "monthly-day",
      label: "هر ماه",
      hint: `روز ${String(solar.day)}`,
      recurrence: { ...base("monthly"), monthlyBy: "dayOfMonth" },
    },
    {
      id: "monthly-nth",
      label: "هر ماه",
      hint: `${nth} ${weekdayName}`,
      recurrence: { ...base("monthly"), monthlyBy: "nthWeekday" },
    },
    {
      id: "yearly",
      label: "هر سال",
      hint: `${String(solar.day)} ${monthName}`,
      recurrence: base("yearly"),
    },
  ];
}

const same = (a: Recurrence, b: Recurrence): boolean =>
  a.freq === b.freq &&
  a.interval === b.interval &&
  a.calendar === b.calendar &&
  (a.monthlyBy ?? "dayOfMonth") === (b.monthlyBy ?? "dayOfMonth") &&
  JSON.stringify(a.byWeekday ?? []) === JSON.stringify(b.byWeekday ?? []);

/** The preset a recurrence matches (ignoring its end), or a generic «سفارشی» entry. */
export function matchPreset(date: LocalDate, recurrence: Recurrence | undefined): RepeatPreset {
  const presets = repeatPresets(date);
  if (recurrence === undefined) return presets[0] as RepeatPreset;
  return (
    presets.find((p) => p.recurrence !== undefined && same(p.recurrence, recurrence)) ?? {
      id: "custom",
      label: "تکرار سفارشی",
      recurrence,
    }
  );
}
