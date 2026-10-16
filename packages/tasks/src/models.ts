import { isValid } from "@dotlife/calendar-core";
import { z } from "zod";

/**
 * Task model (PLAN §15). Dates are stored as Gregorian ISO strings — the canonical form — and only
 * *displayed* in Solar Hijri / Hijri / Shahanshahi via calendar-core. Times are local wall-clock
 * in the task's `timeZone`; this package never touches `Date` except in `localNow()`.
 */

export const LocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .refine((d) => {
    const [year, month, day] = d.split("-").map(Number) as [number, number, number];
    return isValid({ calendar: "gregorian", year, month, day });
  }, "تاریخ وجود ندارد");
/** "2026-10-05" — Gregorian, local to the task's time zone. */
export type LocalDate = z.infer<typeof LocalDateSchema>;

export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");
/** "14:30" — 24h wall-clock. */
export type LocalTime = z.infer<typeof LocalTimeSchema>;

export const TaskPointSchema = z.object({
  date: LocalDateSchema,
  time: LocalTimeSchema.optional(),
});
/** A date, optionally with a time. No time = all-day. */
export type TaskPoint = z.infer<typeof TaskPointSchema>;

/** A point in local time with the time always present — what "now" looks like to this package. */
export type LocalDateTime = { date: LocalDate; time: LocalTime };

export const TaskScheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("due"), due: TaskPointSchema }),
  z.object({ kind: z.literal("range"), start: TaskPointSchema, end: TaskPointSchema }),
]);
export type TaskSchedule = z.infer<typeof TaskScheduleSchema>;

export const WeekdaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const RecurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
  /** every n days/weeks/months/years */
  interval: z.number().int().min(1).max(999),
  /** weekly only: Saturday = 0 … Friday = 6 (calendar-core order). Defaults to the seed's weekday. */
  byWeekday: z.array(WeekdaySchema).min(1).optional(),
  /** monthly only: "the 5th of each month" vs "the first Saturday of each month" */
  monthlyBy: z.enum(["dayOfMonth", "nthWeekday"]).optional(),
  /** which calendar "month" and "year" mean — "اول هر ماه" differs between Solar Hijri and Gregorian */
  calendar: z.enum(["solar-hijri", "gregorian", "hijri"]),
  end: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("never") }),
    z.object({ kind: z.literal("until"), date: LocalDateSchema }),
    z.object({ kind: z.literal("count"), count: z.number().int().min(1) }),
  ]),
});
export type Recurrence = z.infer<typeof RecurrenceSchema>;

export const TaskStatusSchema = z.enum(["todo", "done"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** Exception for one occurrence of a recurring task («فقط این یکی»). */
export const OccurrenceOverrideSchema = z.object({
  originalDate: LocalDateSchema,
  status: TaskStatusSchema.optional(),
  completedAt: z.string().optional(),
  cancelled: z.boolean().optional(),
  schedule: TaskScheduleSchema.optional(),
  title: z.string().optional(),
});
export type OccurrenceOverride = z.infer<typeof OccurrenceOverrideSchema>;

export const TaskReminderSchema = z.discriminatedUnion("anchor", [
  z.object({ anchor: z.literal("start"), offsetMinutes: z.number().int() }),
  z.object({ anchor: z.literal("end"), offsetMinutes: z.number().int() }),
  z.object({ anchor: z.literal("due"), offsetMinutes: z.number().int() }),
  z.object({ anchor: z.literal("absolute"), at: z.string() }),
]);
export type TaskReminder = z.infer<typeof TaskReminderSchema>;

export const TaskSchema = z.object({
  /** UUID v7: sortable by creation time, generated offline. */
  id: z.string().min(1),
  listId: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().optional(),
  /** Per-task colour (`#RRGGBB`) chosen in the planner; falls back to the list's colour. */
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  status: TaskStatusSchema,
  completedAt: z.string().optional(),
  priority: z.enum(["none", "low", "medium", "high"]),
  /** For a recurring task this is the first occurrence (the seed). */
  schedule: TaskScheduleSchema,
  recurrence: RecurrenceSchema.optional(),
  overrides: z.array(OccurrenceOverrideSchema).optional(),
  /** IANA zone, e.g. "Asia/Tehran" — the zone the wall-clock values refer to. */
  timeZone: z.string().min(1),
  reminders: z.array(TaskReminderSchema),
  /** Fractional index for manual ordering — see `orderBetween`. */
  order: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Soft delete for sync. */
  deletedAt: z.string().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskListSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string(),
  order: z.string().min(1),
  isDefault: z.boolean(),
  /** A built-in list with a behaviour of its own: «خرید» suggests everyday groceries as you type. */
  kind: z.enum(["shopping"]).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
});
export type TaskList = z.infer<typeof TaskListSchema>;

/**
 * One item put on the «خرید» list, once per time (2026-10-12, the user: «count کنیم و مشخص باشه از
 * هر کدوم چندبار و در چه زمانی ثبت کرده»). A record of its own (sync entity `purchase`), not read
 * off the tasks: a task is renamed, ticked or deleted, while this stays as it was, so its counts —
 * and the reports the server can draw from the same records later — keep their history. Only ever
 * added, so two phones never clash over one.
 */
export const PurchaseSchema = z.object({
  id: z.string().min(1),
  /** The item as written. */
  title: z.string().min(1),
  /** One spelling for counting: «تخم مرغ» and «تخم‌مرغ» are one item. */
  key: z.string().min(1),
  listId: z.string().min(1),
  /** The task it made. */
  taskId: z.string().min(1),
  /** Picked from the offers above the input, or typed. */
  source: z.enum(["suggestion", "typed"]),
  /** When it was put on the list (ISO). */
  at: z.string(),
});
export type Purchase = z.infer<typeof PurchaseSchema>;

/** One concrete instance of a task on the calendar (a plain task yields exactly one). */
export type Occurrence = {
  taskId: string;
  /** For recurring tasks: the date the occurrence was generated for (the override key). */
  originalDate: LocalDate;
  title: string;
  schedule: Exclude<TaskSchedule, { kind: "none" }>;
  status: TaskStatus;
  /** True when this occurrence comes from a recurrence rule. */
  recurring: boolean;
};
