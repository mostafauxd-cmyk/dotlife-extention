import { addDays, nowKey, pointEndKey, pointKey } from "./dates";
import type { LocalDate, LocalDateTime, Occurrence, Task, TaskPoint } from "./models";
import { expandOccurrences } from "./recurrence";

/**
 * Queries over occurrences (PLAN §15). All take the caller's local "now" — see `localNow()` — so day
 * boundaries follow the task's time zone, not the device's.
 */

/** Occurrences whose span **covers** `day` — not just the ones that start on it. */
export function tasksOnDay(tasks: readonly Task[], day: LocalDate): Occurrence[] {
  return sortByStart(tasks.flatMap((t) => expandOccurrences(t, { from: day, to: day })));
}

/** Occurrences overlapping an inclusive date window (e.g. a month grid). */
export function tasksBetween(tasks: readonly Task[], from: LocalDate, to: LocalDate): Occurrence[] {
  return sortByStart(tasks.flatMap((t) => expandOccurrences(t, { from, to })));
}

/** How far back a missed deadline is still shown. */
const OVERDUE_DAYS = 3660;

/**
 * Still `todo`, and its deadline (due, or end of range) has passed. All-day deadlines expire at end of
 * day. A recurring task gives only its latest such occurrence, so a missed habit does not pile up a
 * row for every day it was skipped (2026-10-07).
 */
export function overdue(tasks: readonly Task[], now: LocalDateTime): Occurrence[] {
  const key = nowKey(now);
  const late = (o: Occurrence): boolean => o.status === "todo" && pointEndKey(deadline(o)) < key;
  const floor = addDays(now.date, -OVERDUE_DAYS);
  const out: Occurrence[] = [];
  for (const t of tasks) {
    if (t.recurrence === undefined) {
      out.push(...expandOccurrences(t, { from: floor, to: now.date }).filter(late));
      continue;
    }
    // walk back from today in slices; the latest missed one is nearly always in the first
    for (let to = now.date, size = 31; to >= floor; size = 365) {
      const from = addDays(to, 1 - size) > floor ? addDays(to, 1 - size) : floor;
      const hit = expandOccurrences(t, { from, to }).filter(late).at(-1);
      if (hit !== undefined) {
        out.push(hit);
        break;
      }
      to = addDays(from, -1);
    }
  }
  return sortByStart(out);
}

/** Range tasks whose start has passed and whose end has not (all-day: the whole day counts). */
export function inProgress(tasks: readonly Task[], now: LocalDateTime): Occurrence[] {
  const key = nowKey(now);
  return tasksOnDay(tasks, now.date).filter(
    (o) =>
      o.status === "todo" &&
      o.schedule.kind === "range" &&
      pointKey(o.schedule.start) <= key &&
      pointEndKey(o.schedule.end) >= key,
  );
}

/** Occurrences starting after `now` within the next `days` days (inclusive of today), soonest first. */
export function upcoming(tasks: readonly Task[], now: LocalDateTime, days: number): Occurrence[] {
  const key = nowKey(now);
  return tasksBetween(tasks, now.date, addDays(now.date, days)).filter(
    (o) => o.status === "todo" && pointKey(start(o)) > key,
  );
}

/** Tasks with no date at all («inbox»). */
export function unscheduled(tasks: readonly Task[]): Task[] {
  return tasks.filter((t) => t.deletedAt === undefined && t.schedule.kind === "none");
}

/** What the «همین الان» block of the tasks section shows: in progress first, then overdue. */
export function rightNow(
  tasks: readonly Task[],
  now: LocalDateTime,
): { inProgress: Occurrence[]; overdue: Occurrence[] } {
  return { inProgress: inProgress(tasks, now), overdue: overdue(tasks, now) };
}

function deadline(o: Occurrence): TaskPoint {
  return o.schedule.kind === "due" ? o.schedule.due : o.schedule.end;
}

function start(o: Occurrence): TaskPoint {
  return o.schedule.kind === "due" ? o.schedule.due : o.schedule.start;
}

function sortByStart(occ: Occurrence[]): Occurrence[] {
  return occ.sort(
    (a, b) => pointKey(start(a)) - pointKey(start(b)) || a.taskId.localeCompare(b.taskId),
  );
}
