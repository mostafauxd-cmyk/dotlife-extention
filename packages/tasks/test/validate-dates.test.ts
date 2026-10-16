import { describe, expect, it } from "vitest";

import {
  addDays,
  addMinutes,
  localNow,
  TaskValidationError,
  validateTask,
  weekdayOf,
} from "../src";
import { due, range, task } from "./helpers";

describe("validation (PLAN §15 rules)", () => {
  it("end before start is rejected, equal is fine", () => {
    expect(() => validateTask(task({ schedule: range("2026-10-05", "2026-10-04") }))).toThrow(
      TaskValidationError,
    );
    expect(() =>
      validateTask(task({ schedule: range("2026-10-05", "2026-10-05", ["10:00", "09:00"]) })),
    ).toThrow(/پایان/);
    expect(() => validateTask(task({ schedule: range("2026-10-05", "2026-10-05") }))).not.toThrow();
  });

  it("start with time and end without (or vice versa) is rejected", () => {
    expect(() =>
      validateTask(
        task({
          schedule: {
            kind: "range",
            start: { date: "2026-10-05", time: "10:00" },
            end: { date: "2026-10-05" },
          },
        }),
      ),
    ).toThrow(/تمام‌روز/);
  });

  it("recurrence needs a due date or range", () => {
    expect(() =>
      validateTask(
        task({
          schedule: { kind: "none" },
          recurrence: {
            freq: "daily",
            interval: 1,
            calendar: "solar-hijri",
            end: { kind: "never" },
          },
        }),
      ),
    ).toThrow(/تکراری/);
  });

  it("until before the seed is rejected", () => {
    expect(() =>
      validateTask(
        task({
          schedule: due("2026-10-05"),
          recurrence: {
            freq: "daily",
            interval: 1,
            calendar: "gregorian",
            end: { kind: "until", date: "2026-10-01" },
          },
        }),
      ),
    ).toThrow(/پایان تکرار/);
  });

  it("an optional per-task colour must be #RRGGBB", () => {
    const schedule = range("2026-10-05", "2026-10-05");
    expect(() => validateTask(task({ schedule, color: "#4C6BFF" }))).not.toThrow();
    expect(() => validateTask(task({ schedule, color: "blue" }))).toThrow(TaskValidationError);
  });

  it("schema violations are reported as 'schema'", () => {
    try {
      validateTask(task({ schedule: due("2026-13-40") }));
      expect.unreachable();
    } catch (e) {
      expect((e as TaskValidationError).code).toBe("schema");
    }
  });
});

describe("local dates", () => {
  it("addDays crosses months and years", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("weekdayOf: 2026-10-05 is a Monday (Saturday = 0 → 2)", () => {
    expect(weekdayOf("2026-10-05")).toBe(2);
  });
  it("addMinutes wraps past midnight", () => {
    expect(addMinutes({ date: "2026-10-05", time: "23:50" }, 20)).toEqual({
      date: "2026-10-06",
      time: "00:10",
    });
    expect(addMinutes({ date: "2026-10-05", time: "00:10" }, -20)).toEqual({
      date: "2026-10-04",
      time: "23:50",
    });
  });

  it("localNow follows the task's zone, not the device's (DST and travel)", () => {
    const instant = new Date("2026-10-04T21:30:00Z");
    expect(localNow("Asia/Tehran", instant)).toEqual({ date: "2026-10-05", time: "01:00" }); // +3:30, no DST
    expect(localNow("Europe/London", instant)).toEqual({ date: "2026-10-04", time: "22:30" }); // BST
    expect(localNow("Europe/London", new Date("2026-11-04T21:30:00Z"))).toEqual({
      date: "2026-11-04",
      time: "21:30",
    }); // GMT
    expect(localNow("America/Los_Angeles", instant)).toEqual({ date: "2026-10-04", time: "14:30" });
  });
});
