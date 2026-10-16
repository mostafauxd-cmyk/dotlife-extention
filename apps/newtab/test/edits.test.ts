import { expandOccurrences, type Occurrence, type Task } from "@dotlife/tasks";
import { describe, expect, it } from "vitest";

import { applyChange, applyDelete, duplicateOccurrence } from "../src/noghte/planner/edits";

const NOW = "2026-10-06T09:00:00.000Z";
let n = 0;
const newId = (): string => `id-${String(++n)}`;

/** Weekly on Monday (2026-10-05 is a Monday = weekday 2) 10:00–11:00. */
function weekly(): Task {
  return {
    id: "w",
    listId: "l",
    title: "جلسه",
    status: "todo",
    priority: "none",
    schedule: {
      kind: "range",
      start: { date: "2026-10-05", time: "10:00" },
      end: { date: "2026-10-05", time: "11:00" },
    },
    recurrence: {
      freq: "weekly",
      interval: 1,
      byWeekday: [2],
      calendar: "solar-hijri",
      end: { kind: "never" },
    },
    timeZone: "Asia/Tehran",
    reminders: [],
    order: "V",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const occOn = (task: Task, date: string): Occurrence => {
  const o = expandOccurrences(task, { from: date, to: date })[0];
  if (o === undefined) throw new Error(`no occurrence on ${date}`);
  return o;
};

const range = (date: string, from: string, to: string) =>
  ({ kind: "range", start: { date, time: from }, end: { date, time: to } }) as const;

describe("applyChange", () => {
  it("a plain task just takes the new schedule and fields", () => {
    const { recurrence: _r, ...plain } = weekly();
    const occ = occOn(plain, "2026-10-05");
    const [t] = applyChange(
      plain,
      occ,
      { schedule: range("2026-10-06", "12:00", "13:30"), color: "#35D07F" },
      "this",
      NOW,
      newId,
    );
    expect(t?.schedule).toEqual(range("2026-10-06", "12:00", "13:30"));
    expect(t?.color).toBe("#35D07F");
  });

  it("«فقط همین» moves one occurrence and leaves the others", () => {
    const task = weekly();
    const occ = occOn(task, "2026-10-12");
    const [t] = applyChange(
      task,
      occ,
      { schedule: range("2026-10-12", "15:00", "16:00") },
      "this",
      NOW,
      newId,
    );
    expect(t).toBeDefined();
    if (t === undefined) return;
    expect(occOn(t, "2026-10-12").schedule).toEqual(range("2026-10-12", "15:00", "16:00"));
    expect(occOn(t, "2026-10-19").schedule).toEqual(range("2026-10-19", "10:00", "11:00"));
  });

  it("«همه» moves the whole series by the same amount, weekday included", () => {
    const task = weekly();
    const occ = occOn(task, "2026-10-12");
    // Monday 10:00 → Tuesday 14:00
    const [t] = applyChange(
      task,
      occ,
      { schedule: range("2026-10-13", "14:00", "15:00") },
      "all",
      NOW,
      newId,
    );
    expect(t?.schedule).toEqual(range("2026-10-06", "14:00", "15:00"));
    expect(t?.recurrence?.byWeekday).toEqual([3]);
    if (t === undefined) return;
    expect(occOn(t, "2026-10-20").schedule).toEqual(range("2026-10-20", "14:00", "15:00"));
  });

  it("«این و بعدی‌ها» splits the series at the occurrence", () => {
    const task = weekly();
    const occ = occOn(task, "2026-10-19");
    const out = applyChange(
      task,
      occ,
      { title: "جلسه‌ی تازه", schedule: range("2026-10-19", "09:00", "10:00") },
      "following",
      NOW,
      newId,
    );
    expect(out).toHaveLength(2);
    const [original, next] = out;
    expect(original?.recurrence?.end).toEqual({ kind: "until", date: "2026-10-18" });
    expect(next?.title).toBe("جلسه‌ی تازه");
    expect(next?.schedule).toEqual(range("2026-10-19", "09:00", "10:00"));
    if (next === undefined) return;
    expect(occOn(next, "2026-10-26").schedule).toEqual(range("2026-10-26", "09:00", "10:00"));
  });

  it("«این و بعدی‌ها» on the first occurrence is the same as «همه»", () => {
    const task = weekly();
    const out = applyChange(
      task,
      occOn(task, "2026-10-05"),
      { title: "x" },
      "following",
      NOW,
      newId,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("w");
  });
});

describe("applyChange keeps a series whole", () => {
  const startDay = (o: Occurrence): string =>
    o.schedule.kind === "due" ? o.schedule.due.date : o.schedule.start.date;
  const all = (tasks: Task[], from: string, to: string): Occurrence[] =>
    tasks.flatMap((t) => expandOccurrences(t, { from, to }));

  it("«این و بعدی‌ها» on a `count` series keeps its total (a rename made it 15 of 10)", () => {
    const daily: Task = {
      ...weekly(),
      recurrence: {
        freq: "daily",
        interval: 1,
        calendar: "solar-hijri",
        end: { kind: "count", count: 10 },
      },
    };
    const out = applyChange(
      daily,
      occOn(daily, "2026-10-10"),
      { title: "نو" },
      "following",
      NOW,
      newId,
    );
    expect(all(out, "2026-10-01", "2026-12-31")).toHaveLength(10);
  });

  it("dragging an occurrence that was moved «فقط همین» moves it with «همه»", () => {
    const t = applyChange(
      weekly(),
      occOn(weekly(), "2026-10-12"),
      { schedule: range("2026-10-12", "08:00", "09:00") },
      "this",
      NOW,
      newId,
    )[0] as Task;
    const moved = occOn(t, "2026-10-12");
    const out = applyChange(
      t,
      moved,
      { schedule: range("2026-10-12", "14:00", "15:00") },
      "all",
      NOW,
      newId,
    );
    for (const o of all(out, "2026-10-05", "2026-10-26")) {
      expect(o.schedule.kind === "range" ? o.schedule.start.time : "", o.originalDate).toBe(
        "14:00",
      );
    }
  });

  it("«همه» to another weekday keeps ticks and deletions on their own occurrences", () => {
    let t = weekly();
    t = applyChange(t, occOn(t, "2026-10-05"), {}, "this", NOW, newId)[0] as Task;
    t = {
      ...t,
      overrides: [
        { originalDate: "2026-10-05", status: "done" },
        { originalDate: "2026-10-19", cancelled: true },
      ],
    };
    // Monday 10-12 to Tuesday 10-13, for the whole series
    const out = applyChange(
      t,
      occOn(t, "2026-10-12"),
      { schedule: range("2026-10-13", "10:00", "11:00") },
      "all",
      NOW,
      newId,
    );
    const occ = all(out, "2026-10-01", "2026-10-31");
    expect(occ.map((o) => [startDay(o), o.status])).toEqual([
      ["2026-10-06", "done"],
      ["2026-10-13", "todo"],
      ["2026-10-27", "todo"],
    ]);
  });

  it("list and reminders reach the new series after a split", () => {
    const out = applyChange(
      weekly(),
      occOn(weekly(), "2026-10-19"),
      { title: "نو", reminders: [{ anchor: "start", offsetMinutes: -60 }], listId: "work" },
      "following",
      NOW,
      newId,
    );
    expect(out).toHaveLength(2);
    for (const t of out) {
      expect(t.listId).toBe("work");
      expect(t.reminders).toEqual([{ anchor: "start", offsetMinutes: -60 }]);
    }
  });
});

describe("applyDelete / duplicate", () => {
  it("deletes one, the rest, or all", () => {
    const task = weekly();
    const occ = occOn(task, "2026-10-12");
    const [one] = applyDelete(task, occ, "this", NOW);
    if (one === undefined) throw new Error();
    expect(expandOccurrences(one, { from: "2026-10-12", to: "2026-10-12" })).toHaveLength(0);
    expect(expandOccurrences(one, { from: "2026-10-19", to: "2026-10-19" })).toHaveLength(1);

    const [rest] = applyDelete(task, occ, "following", NOW);
    expect(rest?.recurrence?.end).toEqual({ kind: "until", date: "2026-10-11" });

    const [all] = applyDelete(task, occ, "all", NOW);
    expect(all?.deletedAt).toBe(NOW);
  });

  it("a duplicate is a plain copy of that one occurrence", () => {
    const task = weekly();
    const copy = duplicateOccurrence(task, occOn(task, "2026-10-12"), NOW, "copy");
    expect(copy.id).toBe("copy");
    expect(copy.recurrence).toBeUndefined();
    expect(copy.schedule).toEqual(range("2026-10-12", "10:00", "11:00"));
  });
});
