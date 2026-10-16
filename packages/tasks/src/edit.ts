import { addDays, dateToJdn, shiftPoint } from "./dates";
import type { LocalDate, OccurrenceOverride, Task, TaskSchedule } from "./models";
import { occurrencesBefore } from "./recurrence";
import { validateTask } from "./validate";

/**
 * Editing operations. All are pure: they return new objects and take `now` (ISO instant) for timestamps.
 * Recurring tasks have three edit scopes (PLAN §15): «فقط این یکی» · «این و بعدی‌ها» · «همه».
 */

export function complete(task: Task, now: string): Task {
  return { ...task, status: "done", completedAt: now, updatedAt: now };
}

export function uncomplete(task: Task, now: string): Task {
  const { completedAt: _dropped, ...rest } = task;
  return { ...rest, status: "todo", updatedAt: now };
}

export function softDelete(task: Task, now: string): Task {
  return { ...task, deletedAt: now, updatedAt: now };
}

/** «فقط این یکی»: record (or merge) an override for one occurrence of a recurring task. */
export function overrideOccurrence(
  task: Task,
  originalDate: LocalDate,
  patch: Omit<OccurrenceOverride, "originalDate">,
  now: string,
): Task {
  if (!task.recurrence) throw new Error("overrideOccurrence: task is not recurring");
  const others = (task.overrides ?? []).filter((o) => o.originalDate !== originalDate);
  const existing = (task.overrides ?? []).find((o) => o.originalDate === originalDate) ?? {
    originalDate,
  };
  const merged: OccurrenceOverride = { ...existing, ...patch, originalDate };
  const next = { ...task, overrides: [...others, merged], updatedAt: now };
  validateTask(next);
  return next;
}

/** Tick one occurrence of a recurring task without touching the others. */
export function completeOccurrence(task: Task, originalDate: LocalDate, now: string): Task {
  return overrideOccurrence(task, originalDate, { status: "done", completedAt: now }, now);
}

export function uncompleteOccurrence(task: Task, originalDate: LocalDate, now: string): Task {
  return overrideOccurrence(task, originalDate, { status: "todo" }, now);
}

/** «فقط این یکی را حذف کن». */
export function cancelOccurrence(task: Task, originalDate: LocalDate, now: string): Task {
  return overrideOccurrence(task, originalDate, { cancelled: true }, now);
}

/** «فقط این یکی را جابه‌جا کن»: move one occurrence to a new schedule (same kind as the seed). */
export function moveOccurrence(
  task: Task,
  originalDate: LocalDate,
  schedule: Exclude<TaskSchedule, { kind: "none" }>,
  now: string,
): Task {
  return overrideOccurrence(task, originalDate, { schedule }, now);
}

/**
 * «این و بعدی‌ها»: split a series at `fromDate`.
 * Returns the truncated original (ends the day before) and a new task whose seed is the occurrence at
 * `fromDate`, carrying `changes`. Overrides move to whichever side they belong to.
 */
export function splitSeries(
  task: Task,
  fromDate: LocalDate,
  changes: Partial<
    Pick<Task, "title" | "notes" | "priority" | "schedule" | "recurrence" | "reminders">
  >,
  newId: string,
  now: string,
): { original: Task; next: Task } {
  if (!task.recurrence || task.schedule.kind === "none") {
    throw new Error("splitSeries: task is not recurring");
  }
  const seed = task.schedule.kind === "due" ? task.schedule.due.date : task.schedule.start.date;
  const delta = dateToJdn(fromDate) - dateToJdn(seed);
  const shifted: TaskSchedule =
    task.schedule.kind === "due"
      ? { kind: "due", due: shiftPoint(task.schedule.due, delta) }
      : {
          kind: "range",
          start: shiftPoint(task.schedule.start, delta),
          end: shiftPoint(task.schedule.end, delta),
        };

  const before = (task.overrides ?? []).filter((o) => o.originalDate < fromDate);
  const after = (task.overrides ?? []).filter((o) => o.originalDate >= fromDate);

  const original: Task = {
    ...task,
    recurrence: { ...task.recurrence, end: { kind: "until", date: addDays(fromDate, -1) } },
    overrides: before,
    updatedAt: now,
  };
  const next: Task = {
    ...task,
    ...changes,
    id: newId,
    schedule: changes.schedule ?? shifted,
    recurrence: changes.recurrence ?? remainingRule(task, fromDate),
    overrides: after,
    status: "todo",
    createdAt: now,
    updatedAt: now,
  };
  delete (next as { completedAt?: string }).completedAt;
  validateTask(original);
  validateTask(next);
  return { original, next };
}

/** For a count-limited series, the new half keeps only the occurrences not yet consumed. */
function remainingRule(task: Task, fromDate: LocalDate): Task["recurrence"] {
  const r = task.recurrence;
  if (!r || r.end.kind !== "count") return r;
  const consumed = occurrencesBefore(task, fromDate);
  return { ...r, end: { kind: "count", count: Math.max(1, r.end.count - consumed) } };
}
