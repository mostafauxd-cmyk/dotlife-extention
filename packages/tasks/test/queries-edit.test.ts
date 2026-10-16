import { describe, expect, it } from "vitest";

import {
  cancelOccurrence,
  complete,
  completeOccurrence,
  expandOccurrences,
  FIRST_ORDER,
  inProgress,
  moveOccurrence,
  orderBetween,
  overdue,
  reminderTimes,
  rightNow,
  splitSeries,
  tasksOnDay,
  uncomplete,
  unscheduled,
  upcoming,
  uuidv7,
  type Recurrence,
} from "../src";
import { due, NOW_ISO, range, task } from "./helpers";

const NOW = { date: "2026-10-05", time: "12:00" };
const daily: Recurrence = {
  freq: "daily",
  interval: 1,
  calendar: "gregorian",
  end: { kind: "never" },
};

describe("queries", () => {
  const tasks = [
    task({ id: "multi", title: "چندروزه", schedule: range("2026-10-03", "2026-10-07") }),
    task({
      id: "timed",
      title: "در جریان",
      schedule: range("2026-10-05", "2026-10-05", ["10:00", "13:00"]),
    }),
    task({
      id: "later",
      title: "بعداً",
      schedule: range("2026-10-05", "2026-10-05", ["14:00", "15:00"]),
    }),
    task({ id: "late-allday", title: "دیروز تمام‌روز", schedule: due("2026-10-04") }),
    task({ id: "today-allday", title: "امروز تمام‌روز", schedule: due("2026-10-05") }),
    task({ id: "late-timed", title: "صبح", schedule: due("2026-10-05", "09:00") }),
    task({ id: "done-late", title: "انجام‌شده", schedule: due("2026-10-01"), status: "done" }),
    task({ id: "inbox", title: "بدون تاریخ", schedule: { kind: "none" } }),
    task({ id: "next-week", schedule: due("2026-10-11") }),
    task({ id: "daily", schedule: due("2026-10-01", "18:00"), recurrence: daily }),
  ];

  it("tasksOnDay covers multi-day ranges, not just their start", () => {
    const ids = tasksOnDay(tasks, "2026-10-06").map((o) => o.taskId);
    expect(ids).toContain("multi");
    expect(ids).toContain("daily");
    expect(ids).not.toContain("timed");
  });

  it("tasksOnDay is sorted by start time, all-day first", () => {
    const ids = tasksOnDay(tasks, "2026-10-05").map((o) => o.taskId);
    expect(ids.indexOf("multi")).toBeLessThan(ids.indexOf("late-timed"));
    expect(ids.indexOf("late-timed")).toBeLessThan(ids.indexOf("timed"));
    expect(ids.indexOf("timed")).toBeLessThan(ids.indexOf("later"));
  });

  it("overdue: past deadline and still todo; all-day expires at end of day; done is excluded", () => {
    const ids = overdue(tasks, NOW).map((o) => o.taskId);
    expect(ids).toContain("late-allday");
    expect(ids).toContain("late-timed");
    expect(ids).not.toContain("today-allday"); // still today
    expect(ids).not.toContain("done-late");
    expect(ids).not.toContain("timed"); // ends 13:00, now 12:00
    expect(ids).toEqual(expect.arrayContaining(["daily"])); // yesterday's 18:00 occurrence
  });

  it("overdue: a missed recurring task shows once, at its latest missed occurrence", () => {
    // daily since 10-01 at 18:00, never ticked: 10-01…10-04 are all missed; only 10-04 shows
    const daily_ = overdue(tasks, NOW).filter((o) => o.taskId === "daily");
    expect(daily_.map((o) => o.originalDate)).toEqual(["2026-10-04"]);

    // the recent ones done, one from two months back still open: that one is found
    let habit = task({ id: "habit", schedule: due("2026-08-01"), recurrence: daily });
    for (let d = 2; d <= 31; d++)
      habit = completeOccurrence(habit, `2026-08-${String(d).padStart(2, "0")}`, NOW_ISO);
    for (let d = 1; d <= 30; d++)
      habit = completeOccurrence(habit, `2026-09-${String(d).padStart(2, "0")}`, NOW_ISO);
    for (let d = 1; d <= 4; d++)
      habit = completeOccurrence(habit, `2026-10-0${String(d)}`, NOW_ISO);
    expect(overdue([habit], NOW).map((o) => o.originalDate)).toEqual(["2026-08-01"]);
  });

  it("inProgress: now is between start and end", () => {
    expect(inProgress(tasks, NOW).map((o) => o.taskId)).toEqual(["multi", "timed"]);
    expect(inProgress(tasks, { date: "2026-10-05", time: "13:30" }).map((o) => o.taskId)).toEqual([
      "multi",
    ]);
  });

  it("upcoming: starts after now within n days", () => {
    const ids = upcoming(tasks, NOW, 7).map((o) => o.taskId);
    expect(ids[0]).toBe("later");
    expect(ids).toContain("next-week");
    expect(ids).not.toContain("timed");
    expect(upcoming(tasks, NOW, 3).map((o) => o.taskId)).not.toContain("next-week");
  });

  it("unscheduled and rightNow", () => {
    expect(unscheduled(tasks).map((t) => t.id)).toEqual(["inbox"]);
    const rn = rightNow(tasks, NOW);
    expect(rn.inProgress.map((o) => o.taskId)).toEqual(["multi", "timed"]);
    expect(rn.overdue.length).toBeGreaterThan(0);
  });
});

describe("editing", () => {
  it("complete / uncomplete", () => {
    const t = task({ schedule: due("2026-10-05") });
    const done = complete(t, NOW_ISO);
    expect(done).toMatchObject({ status: "done", completedAt: NOW_ISO });
    expect(overdue([done], { date: "2026-10-09", time: "08:00" })).toEqual([]);
    const back = uncomplete(done, NOW_ISO);
    expect(back.status).toBe("todo");
    expect("completedAt" in back).toBe(false);
  });

  it("«فقط این یکی»: completing one occurrence leaves the rest todo", () => {
    const t = task({ schedule: due("2026-10-01"), recurrence: daily });
    const edited = completeOccurrence(t, "2026-10-03", NOW_ISO);
    const occ = expandOccurrences(edited, { from: "2026-10-02", to: "2026-10-04" });
    expect(occ.map((o) => o.status)).toEqual(["todo", "done", "todo"]);
    const cancelled = cancelOccurrence(edited, "2026-10-02", NOW_ISO);
    expect(
      expandOccurrences(cancelled, { from: "2026-10-02", to: "2026-10-04" }).map(
        (o) => o.originalDate,
      ),
    ).toEqual(["2026-10-03", "2026-10-04"]);
    const moved = moveOccurrence(
      cancelled,
      "2026-10-04",
      { kind: "due", due: { date: "2026-10-05", time: "20:00" } },
      NOW_ISO,
    );
    expect(
      expandOccurrences(moved, { from: "2026-10-05", to: "2026-10-05" })
        .map((o) => o.originalDate)
        .sort(),
    ).toEqual(["2026-10-04", "2026-10-05"]);
  });

  it("«این و بعدی‌ها» on a count series keeps the total, even for long intervals", () => {
    // every 2 years, 5 times: 2026 2028 2030 2032 2034 — split at the last one leaves one
    const t = task({
      schedule: due("2026-01-01"),
      recurrence: { ...daily, freq: "yearly", interval: 2, end: { kind: "count", count: 5 } },
    });
    const { next } = splitSeries(t, "2034-01-01", {}, "y-2", NOW_ISO);
    expect(next.recurrence?.end).toEqual({ kind: "count", count: 1 });
    const d = task({
      schedule: due("2026-10-01"),
      recurrence: { ...daily, end: { kind: "count", count: 10 } },
    });
    expect(splitSeries(d, "2026-10-06", {}, "d-2", NOW_ISO).next.recurrence?.end).toEqual({
      kind: "count",
      count: 5,
    });
  });

  it("«این و بعدی‌ها»: splitSeries truncates the original and starts a new series", () => {
    const t = task({
      id: "series",
      title: "ورزش",
      schedule: range("2026-10-01", "2026-10-01", ["07:00", "08:00"]),
      recurrence: daily,
      overrides: [
        { originalDate: "2026-10-02", status: "done" },
        { originalDate: "2026-10-06", cancelled: true },
      ],
    });
    const { original, next } = splitSeries(
      t,
      "2026-10-05",
      { title: "ورزش صبحگاهی", schedule: range("2026-10-05", "2026-10-05", ["06:30", "07:30"]) },
      "series-2",
      NOW_ISO,
    );
    expect(original.recurrence?.end).toEqual({ kind: "until", date: "2026-10-04" });
    expect(original.overrides?.map((o) => o.originalDate)).toEqual(["2026-10-02"]);
    expect(next.id).toBe("series-2");
    expect(next.title).toBe("ورزش صبحگاهی");
    expect(next.overrides?.map((o) => o.originalDate)).toEqual(["2026-10-06"]);
    const before = expandOccurrences(original, { from: "2026-10-01", to: "2026-10-10" });
    const after = expandOccurrences(next, { from: "2026-10-01", to: "2026-10-10" });
    expect(before.map((o) => o.originalDate)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(after.map((o) => o.originalDate)).toEqual([
      "2026-10-05",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
    expect(after[0]?.schedule).toEqual({
      kind: "range",
      start: { date: "2026-10-05", time: "06:30" },
      end: { date: "2026-10-05", time: "07:30" },
    });
  });

  it("splitSeries on a count-limited series keeps the remaining count", () => {
    const t = task({
      schedule: due("2026-10-01"),
      recurrence: { ...daily, end: { kind: "count", count: 5 } },
    });
    const { next } = splitSeries(t, "2026-10-04", {}, "n", NOW_ISO);
    expect(next.recurrence?.end).toEqual({ kind: "count", count: 2 });
  });
});

describe("ordering, ids, reminders", () => {
  it("orderBetween always yields a key strictly between its bounds (random insertions)", () => {
    let keys = [FIRST_ORDER];
    let seed = 42;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 500; i++) {
      const pos = Math.floor(rnd() * (keys.length + 1));
      const a = keys[pos - 1];
      const b = keys[pos];
      const k = orderBetween(a, b);
      if (a !== undefined) expect(k > a, `${k} > ${a}`).toBe(true);
      if (b !== undefined) expect(k < b, `${k} < ${b}`).toBe(true);
      keys = [...keys.slice(0, pos), k, ...keys.slice(pos)];
    }
    expect([...keys].sort()).toEqual(keys);
    expect(() => orderBetween("b", "a")).toThrow(RangeError);
  });

  it("uuidv7 is time-ordered and well-formed", () => {
    const a = uuidv7(1_000_000, () => new Uint8Array(10).fill(0));
    const b = uuidv7(1_000_001, () => new Uint8Array(10).fill(0));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
    expect(uuidv7()).not.toBe(uuidv7());
  });

  it("reminderTimes: 30 minutes before the end of a range, all-day due at 09:00", () => {
    const r = expandOccurrences(
      task({ schedule: range("2026-10-05", "2026-10-05", ["10:00", "13:00"]) }),
      { from: "2026-10-05", to: "2026-10-05" },
    )[0];
    expect(
      reminderTimes(r as never, [
        { anchor: "end", offsetMinutes: -30 },
        { anchor: "start", offsetMinutes: 0 },
      ]),
    ).toEqual([
      { date: "2026-10-05", time: "10:00" },
      { date: "2026-10-05", time: "12:30" },
    ]);
    const d = expandOccurrences(task({ schedule: due("2026-10-06") }), {
      from: "2026-10-06",
      to: "2026-10-06",
    })[0];
    expect(reminderTimes(d as never, [{ anchor: "due", offsetMinutes: -1440 }])).toEqual([
      { date: "2026-10-05", time: "09:00" },
    ]);
  });
});
