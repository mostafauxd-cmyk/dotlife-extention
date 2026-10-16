import { convert, type CalendarDate } from "@dotlife/calendar-core";
import { describe, expect, it } from "vitest";

import { expandOccurrences, MAX_OCCURRENCES, type Recurrence } from "../src";
import { due, range, task } from "./helpers";

const dates = (occ: { originalDate: string }[]): string[] => occ.map((o) => o.originalDate);
const solar = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const j: CalendarDate = convert(
    { calendar: "gregorian", year: y, month: m, day: d },
    "solar-hijri",
  );
  return `${String(j.year)}/${String(j.month)}/${String(j.day)}`;
};
const rule = (r: Partial<Recurrence>): Recurrence => ({
  freq: "daily",
  interval: 1,
  calendar: "solar-hijri",
  end: { kind: "never" },
  ...r,
});

describe("expandOccurrences", () => {
  it("a plain task yields one occurrence only when it overlaps the window", () => {
    const t = task({ schedule: range("2026-10-03", "2026-10-07") });
    expect(expandOccurrences(t, { from: "2026-10-05", to: "2026-10-05" })).toHaveLength(1);
    expect(expandOccurrences(t, { from: "2026-10-08", to: "2026-10-09" })).toHaveLength(0);
    expect(expandOccurrences(t, { from: "2026-09-01", to: "2026-10-03" })).toHaveLength(1);
  });

  it("daily every 2 days, lazily within the window", () => {
    const t = task({ schedule: due("2026-10-01", "09:00"), recurrence: rule({ interval: 2 }) });
    const occ = expandOccurrences(t, { from: "2026-10-04", to: "2026-10-10" });
    expect(dates(occ)).toEqual(["2026-10-05", "2026-10-07", "2026-10-09"]);
    expect(occ[0]?.schedule).toEqual({ kind: "due", due: { date: "2026-10-05", time: "09:00" } });
    expect(occ[0]?.recurring).toBe(true);
  });

  it("weekly on Saturday and Monday (0, 2), every week", () => {
    // seed Monday 2026-10-05
    const t = task({
      schedule: due("2026-10-05"),
      recurrence: rule({ freq: "weekly", byWeekday: [0, 2] }),
    });
    expect(dates(expandOccurrences(t, { from: "2026-10-01", to: "2026-10-20" }))).toEqual([
      "2026-10-05",
      "2026-10-10",
      "2026-10-12",
      "2026-10-17",
      "2026-10-19",
    ]);
  });

  it("weekly every 2 weeks defaults to the seed's weekday", () => {
    const t = task({
      schedule: due("2026-10-05"),
      recurrence: rule({ freq: "weekly", interval: 2 }),
    });
    expect(dates(expandOccurrences(t, { from: "2026-10-01", to: "2026-11-05" }))).toEqual([
      "2026-10-05",
      "2026-10-19",
      "2026-11-02",
    ]);
  });

  it("monthly on the 31st in Solar Hijri clamps to 30 in autumn and 29 in Esfand", () => {
    // 31 Shahrivar 1405 = 2026-09-22
    const t = task({
      schedule: due("2026-09-22"),
      recurrence: rule({ freq: "monthly", monthlyBy: "dayOfMonth" }),
    });
    const occ = expandOccurrences(t, { from: "2026-09-01", to: "2027-04-30" });
    expect(occ.map((o) => solar(o.originalDate))).toEqual([
      "1405/6/31",
      "1405/7/30",
      "1405/8/30",
      "1405/9/30",
      "1405/10/30",
      "1405/11/30",
      "1405/12/29",
      "1406/1/31",
    ]);
  });

  it("monthly in Gregorian vs Solar Hijri differ — «اول هر ماه»", () => {
    const g = task({
      schedule: due("2026-10-01"),
      recurrence: rule({ freq: "monthly", calendar: "gregorian" }),
    });
    const s = task({
      schedule: due("2026-09-23"),
      recurrence: rule({ freq: "monthly", calendar: "solar-hijri" }),
    }); // 1 Mehr
    expect(dates(expandOccurrences(g, { from: "2026-10-01", to: "2026-12-31" }))).toEqual([
      "2026-10-01",
      "2026-11-01",
      "2026-12-01",
    ]);
    expect(dates(expandOccurrences(s, { from: "2026-09-23", to: "2026-12-31" }))).toEqual([
      "2026-09-23",
      "2026-10-23",
      "2026-11-22",
      "2026-12-22",
    ]);
  });

  it("monthly by nth weekday: first Monday of each Gregorian month", () => {
    const t = task({
      schedule: due("2026-10-05"),
      recurrence: rule({ freq: "monthly", monthlyBy: "nthWeekday", calendar: "gregorian" }),
    });
    expect(dates(expandOccurrences(t, { from: "2026-10-01", to: "2027-01-31" }))).toEqual([
      "2026-10-05",
      "2026-11-02",
      "2026-12-07",
      "2027-01-04",
    ]);
  });

  it("yearly on 30 Esfand only exists in leap years → 29 Esfand otherwise", () => {
    // 30 Esfand 1403 = 2025-03-20
    const t = task({ schedule: due("2025-03-20"), recurrence: rule({ freq: "yearly" }) });
    expect(
      expandOccurrences(t, { from: "2025-01-01", to: "2030-12-31" }).map((o) =>
        solar(o.originalDate),
      ),
    ).toEqual(["1403/12/30", "1404/12/29", "1405/12/29", "1406/12/29", "1407/12/29", "1408/12/30"]);
  });

  it("hijri yearly: same Hijri month/day each year (arithmetic calendar)", () => {
    const t = task({
      schedule: due("2026-03-20"),
      recurrence: rule({ freq: "yearly", calendar: "hijri" }),
    });
    const occ = expandOccurrences(t, { from: "2026-01-01", to: "2027-12-31" });
    expect(occ).toHaveLength(2);
    const h = (iso: string): CalendarDate => {
      const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
      return convert({ calendar: "gregorian", year: y, month: m, day: d }, "hijri");
    };
    expect(h(occ[1]?.originalDate ?? "").month).toBe(h(occ[0]?.originalDate ?? "").month);
    expect(h(occ[1]?.originalDate ?? "").day).toBe(h(occ[0]?.originalDate ?? "").day);
  });

  it("end: until / count", () => {
    const until = task({
      schedule: due("2026-10-01"),
      recurrence: rule({ end: { kind: "until", date: "2026-10-03" } }),
    });
    expect(dates(expandOccurrences(until, { from: "2026-09-01", to: "2026-12-31" }))).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    const count = task({
      schedule: due("2026-10-01"),
      recurrence: rule({ interval: 3, end: { kind: "count", count: 2 } }),
    });
    expect(dates(expandOccurrences(count, { from: "2026-09-01", to: "2026-12-31" }))).toEqual([
      "2026-10-01",
      "2026-10-04",
    ]);
  });

  it("range occurrences keep their length and show on every covered day", () => {
    const t = task({
      schedule: range("2026-10-05", "2026-10-07", ["09:00", "17:00"]),
      recurrence: rule({ freq: "weekly" }),
    });
    const occ = expandOccurrences(t, { from: "2026-10-13", to: "2026-10-13" }); // Tuesday inside the 2nd occurrence (Mon 12 – Wed 14)
    expect(occ).toHaveLength(1);
    expect(occ[0]?.schedule).toEqual({
      kind: "range",
      start: { date: "2026-10-12", time: "09:00" },
      end: { date: "2026-10-14", time: "17:00" },
    });
  });

  it("overrides: cancelled, moved, done, retitled", () => {
    const t = task({
      schedule: due("2026-10-01", "09:00"),
      recurrence: rule({}),
      overrides: [
        { originalDate: "2026-10-02", cancelled: true },
        {
          originalDate: "2026-10-03",
          schedule: { kind: "due", due: { date: "2026-10-03", time: "15:00" } },
          title: "moved",
        },
        { originalDate: "2026-10-04", status: "done" },
      ],
    });
    const occ = expandOccurrences(t, { from: "2026-10-01", to: "2026-10-04" });
    expect(dates(occ)).toEqual(["2026-10-01", "2026-10-03", "2026-10-04"]);
    expect(occ[1]).toMatchObject({
      title: "moved",
      schedule: { kind: "due", due: { date: "2026-10-03", time: "15:00" } },
    });
    expect(occ[2]?.status).toBe("done");
    expect(occ[0]?.status).toBe("todo");
  });

  it("never materialises an endless series: hard cap", () => {
    const t = task({ schedule: due("2000-01-01"), recurrence: rule({}) });
    const occ = expandOccurrences(t, { from: "2000-01-01", to: "2099-12-31" });
    expect(occ.length).toBe(MAX_OCCURRENCES);
  });

  it("an old series still reaches today (the cap counts from the window, not the seed)", () => {
    const t = task({ schedule: due("2020-03-01", "07:00"), recurrence: rule({}) });
    expect(dates(expandOccurrences(t, { from: "2026-10-07", to: "2026-10-07" }))).toEqual([
      "2026-10-07",
    ]);
  });

  it("starting near the window gives what walking from the seed gives", () => {
    const window = { from: "2026-02-10", to: "2026-03-20" };
    const rules: Partial<Recurrence>[] = [
      { interval: 3 },
      { interval: 2, end: { kind: "count", count: 200 } },
      { freq: "weekly", byWeekday: [0, 2, 5] },
      { freq: "weekly", interval: 2, byWeekday: [1, 4], end: { kind: "count", count: 70 } },
      { freq: "weekly", byWeekday: [3], end: { kind: "until", date: "2026-03-01" } },
      { freq: "monthly", end: { kind: "count", count: 15 } },
    ];
    for (const r of rules) {
      for (const schedule of [due("2024-11-14", "08:00"), range("2024-11-14", "2024-11-17")]) {
        const t = task({ schedule, recurrence: rule(r) });
        const all = expandOccurrences(t, { from: "2024-11-14", to: window.to });
        const expected = all.filter((o) => {
          const end = o.schedule.kind === "due" ? o.schedule.due.date : o.schedule.end.date;
          return end >= window.from;
        });
        expect(expandOccurrences(t, window)).toEqual(expected);
      }
    }
  });

  it("an occurrence moved from long ago into the window is still found", () => {
    const t = task({
      schedule: due("2025-01-01"),
      recurrence: rule({}),
      overrides: [
        { originalDate: "2025-01-05", schedule: { kind: "due", due: { date: "2026-10-07" } } },
      ],
    });
    expect(dates(expandOccurrences(t, { from: "2026-10-07", to: "2026-10-07" }))).toEqual([
      "2025-01-05",
      "2026-10-07",
    ]);
  });

  it("one old move does not hide a daily series years later", () => {
    const t = task({
      schedule: due("2023-01-01", "08:00"),
      recurrence: rule({}),
      overrides: [{ originalDate: "2023-02-01", schedule: due("2023-02-01", "09:00") }],
    });
    expect(expandOccurrences(t, { from: "2026-10-12", to: "2026-10-18" })).toHaveLength(7);
  });

  it("an occurrence moved earlier, from after the window into it, is found", () => {
    // weekly on Thursdays from 2026-10-01; the 10-22 one moved to Friday 10-16
    const t = task({
      schedule: due("2026-10-01"),
      recurrence: rule({ freq: "weekly" }),
      overrides: [{ originalDate: "2026-10-22", schedule: due("2026-10-16") }],
    });
    const week = expandOccurrences(t, { from: "2026-10-14", to: "2026-10-20" });
    expect(
      week.map((o) => [o.originalDate, o.schedule.kind === "due" ? o.schedule.due.date : ""]),
    ).toEqual([
      ["2026-10-15", "2026-10-15"],
      ["2026-10-22", "2026-10-16"],
    ]);
    expect(dates(expandOccurrences(t, { from: "2026-10-21", to: "2026-10-27" }))).toEqual([]);
  });

  it("a move left over from a date the rule no longer has is not shown", () => {
    const t = task({
      schedule: due("2026-10-01"),
      recurrence: rule({ end: { kind: "count", count: 3 } }),
      overrides: [{ originalDate: "2026-10-09", schedule: due("2026-10-02") }],
    });
    expect(dates(expandOccurrences(t, { from: "2026-10-01", to: "2026-10-31" }))).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("a weekday listed twice counts once", () => {
    const t = task({
      schedule: due("2026-10-12"),
      recurrence: rule({ freq: "weekly", byWeekday: [2, 2], end: { kind: "count", count: 4 } }),
    });
    expect(dates(expandOccurrences(t, { from: "2026-10-01", to: "2026-12-31" }))).toEqual([
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
      "2026-11-02",
    ]);
  });

  it("deleted tasks and unscheduled tasks yield nothing", () => {
    expect(
      expandOccurrences(task({ schedule: due("2026-10-05"), deletedAt: "x" }), {
        from: "2026-10-05",
        to: "2026-10-05",
      }),
    ).toEqual([]);
    expect(
      expandOccurrences(task({ schedule: { kind: "none" } }), {
        from: "2026-10-05",
        to: "2026-10-05",
      }),
    ).toEqual([]);
  });
});
