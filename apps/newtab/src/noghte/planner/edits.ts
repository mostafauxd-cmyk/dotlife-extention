// A copy of dotlife apps/mobile/src/planner/edits.ts, so the extension edits tasks exactly as the app does. Keep the two in step.
import {
  addDays,
  cancelOccurrence,
  dateToJdn,
  overrideOccurrence,
  softDelete,
  splitSeries,
  type LocalDate,
  type Occurrence,
  type OccurrenceOverride,
  type Recurrence,
  type Task,
  type TaskReminder,
  type TaskSchedule,
} from "@dotlife/tasks";

/**
 * How a change to one occurrence lands on its task (PLAN §15): plain tasks just change; a recurring
 * one changes «فقط همین» (an override), «این و بعدی‌ها» (the series splits) or «همه» (the seed moves
 * by the same amount). Pure, so the planner's drag, sheet and menu all share it and it is unit-tested.
 */

export type Scope = "this" | "following" | "all";
type Timed = Exclude<TaskSchedule, { kind: "none" }>;

export type OccurrenceChange = {
  /** The occurrence's new schedule, in absolute dates (what the user sees). */
  schedule?: Timed;
  title?: string;
  notes?: string | null;
  color?: string | null;
  recurrence?: Recurrence | null;
  /** List and reminders belong to the whole task whatever the scope: after a split, to both halves. */
  listId?: string;
  reminders?: TaskReminder[];
};

const startOf = (s: Timed) => (s.kind === "due" ? s.due : s.start);
const dayShift = (from: Timed, to: Timed): number =>
  dateToJdn(startOf(to).date) - dateToJdn(startOf(from).date);

/** Seed schedule moved by the day difference between the occurrence's old and new start, with the new times. */
function shiftSeed(seed: Timed, from: Timed, to: Timed): Timed {
  const days = dayShift(from, to);
  if (seed.kind === "due" || to.kind === "due") {
    const due = startOf(seed);
    const t = startOf(to);
    return {
      kind: "due",
      due: { date: addDays(due.date, days), ...(t.time === undefined ? {} : { time: t.time }) },
    };
  }
  const span = dateToJdn(to.end.date) - dateToJdn(to.start.date);
  const startDate = addDays(seed.start.date, days);
  return {
    kind: "range",
    start: { date: startDate, ...(to.start.time === undefined ? {} : { time: to.start.time }) },
    end: {
      date: addDays(startDate, span),
      ...(to.end.time === undefined ? {} : { time: to.end.time }),
    },
  };
}

/** A weekly rule's weekdays moved by `days` (moving Thursday's meeting to Friday moves the series). */
function shiftWeekdays(rule: Recurrence, days: number): Recurrence {
  if (rule.freq !== "weekly" || rule.byWeekday === undefined || days % 7 === 0) return rule;
  const byWeekday = rule.byWeekday.map(
    (w) => ((((w + days) % 7) + 7) % 7) as NonNullable<Recurrence["byWeekday"]>[number],
  );
  return { ...rule, byWeekday };
}

/** The task's fields after a change that applies to the whole task / series. */
function withFields(task: Task, change: OccurrenceChange, schedule: TaskSchedule): Task {
  const { notes: _n, color: _c, recurrence: _r, ...rest } = task;
  const notes = change.notes === undefined ? task.notes : (change.notes ?? undefined);
  const color = change.color === undefined ? task.color : (change.color ?? undefined);
  const recurrence =
    change.recurrence === undefined ? task.recurrence : (change.recurrence ?? undefined);
  return {
    ...rest,
    title: change.title ?? task.title,
    schedule,
    ...(notes === undefined || notes === "" ? {} : { notes }),
    ...(color === undefined ? {} : { color }),
    ...(recurrence === undefined ? {} : { recurrence }),
  };
}

const seedDate = (task: Task): LocalDate | undefined =>
  task.schedule.kind === "none" ? undefined : startOf(task.schedule).date;

/**
 * Overrides once the whole series (or the rest of it) moves by `days`: each keeps to its own
 * occurrence (a tick, a deletion) instead of being left on a date the series no longer has. The
 * edited occurrence's own move and title give way to the change being made to it.
 */
function carryOverrides(
  overrides: readonly OccurrenceOverride[] | undefined,
  edited: LocalDate,
  change: OccurrenceChange,
  days: number,
): OccurrenceOverride[] {
  const out: OccurrenceOverride[] = [];
  for (const o of overrides ?? []) {
    let next: OccurrenceOverride = o;
    if (o.originalDate === edited) {
      const { schedule: _s, title: _t, ...rest } = o;
      next = {
        ...rest,
        ...(change.schedule === undefined && o.schedule !== undefined
          ? { schedule: o.schedule }
          : {}),
        ...(change.title === undefined && o.title !== undefined ? { title: o.title } : {}),
      };
    }
    if (days !== 0) next = { ...next, originalDate: addDays(next.originalDate, days) };
    // nothing left to say about that occurrence
    if (Object.keys(next).length > 1) out.push(next);
  }
  return out;
}

/** The whole-task fields (list, reminders) laid on every task a change produced. */
function withWhole(tasks: Task[], change: OccurrenceChange): Task[] {
  if (change.listId === undefined && change.reminders === undefined) return tasks;
  return tasks.map((t) => ({
    ...t,
    ...(change.listId === undefined ? {} : { listId: change.listId }),
    ...(change.reminders === undefined ? {} : { reminders: change.reminders }),
  }));
}

/**
 * Tasks to store after changing `occurrence` of `task`. A plain task (or a recurring one edited
 * «همه») yields one task; «این و بعدی‌ها» yields the truncated series plus the new one.
 */
export function applyChange(
  task: Task,
  occurrence: Occurrence,
  change: OccurrenceChange,
  scope: Scope,
  now: string,
  newId: () => string,
): Task[] {
  return withWhole(changed(task, occurrence, change, scope, now, newId), change);
}

function changed(
  task: Task,
  occurrence: Occurrence,
  change: OccurrenceChange,
  scope: Scope,
  now: string,
  newId: () => string,
): Task[] {
  const target = change.schedule ?? occurrence.schedule;
  if (task.recurrence === undefined) {
    return [{ ...withFields(task, change, target), updatedAt: now }];
  }
  const firstOccurrence = occurrence.originalDate <= (seedDate(task) ?? occurrence.originalDate);
  const effective: Scope = scope === "following" && firstOccurrence ? "all" : scope;

  if (effective === "this") {
    return [
      overrideOccurrence(
        task,
        occurrence.originalDate,
        {
          schedule: target,
          ...(change.title === undefined ? {} : { title: change.title }),
        },
        now,
      ),
    ];
  }
  const days = change.schedule === undefined ? 0 : dayShift(occurrence.schedule, target);
  // a move to another weekday carries the weekly rule along (unless the sheet set a new rule)
  const moved: OccurrenceChange =
    change.schedule !== undefined && change.recurrence === undefined
      ? {
          ...change,
          recurrence: shiftWeekdays(task.recurrence, days),
        }
      : change;

  if (effective === "following") {
    const next = withFields(task, moved, target);
    const { original, next: split } = splitSeries(
      task,
      occurrence.originalDate,
      {
        title: next.title,
        schedule: target,
        ...(next.notes === undefined ? {} : { notes: next.notes }),
        // only a rule the user chose; otherwise splitSeries keeps the rest of a `count` series
        ...(change.recurrence === undefined ? {} : { recurrence: next.recurrence }),
      },
      newId(),
      now,
    );
    const { color: _c, recurrence: kept, ...splitRest } = split;
    // the rule moved to another weekday, with what is left of its end
    const recurrence =
      change.recurrence === undefined && moved.recurrence && kept
        ? { ...moved.recurrence, end: kept.end }
        : kept;
    // «تکرار نشود» from here on: the new half is one plain task
    const { overrides: _o, ...plain } = splitRest;
    const rest: Task =
      change.recurrence === null
        ? plain
        : {
            ...splitRest,
            ...(recurrence === undefined ? {} : { recurrence }),
            overrides: carryOverrides(split.overrides, occurrence.originalDate, change, days),
          };
    return [original, next.color === undefined ? rest : { ...rest, color: next.color }];
  }
  // «همه»: move the seed the way this occurrence moved
  const seed = task.schedule.kind === "none" ? target : task.schedule;
  const schedule =
    change.schedule === undefined ? seed : shiftSeed(seed, occurrence.schedule, target);
  return [
    {
      ...withFields(task, moved, schedule),
      ...(task.overrides === undefined
        ? {}
        : { overrides: carryOverrides(task.overrides, occurrence.originalDate, change, days) }),
      updatedAt: now,
    },
  ];
}

/** Tasks to store after deleting `occurrence` with `scope`. */
export function applyDelete(task: Task, occurrence: Occurrence, scope: Scope, now: string): Task[] {
  if (task.recurrence === undefined || scope === "all") return [softDelete(task, now)];
  if (scope === "this") return [cancelOccurrence(task, occurrence.originalDate, now)];
  // «این و بعدی‌ها»: end the series the day before (or drop it all from its first occurrence)
  if (occurrence.originalDate <= (seedDate(task) ?? occurrence.originalDate)) {
    return [softDelete(task, now)];
  }
  return [
    {
      ...task,
      recurrence: {
        ...task.recurrence,
        end: { kind: "until", date: addDays(occurrence.originalDate, -1) },
      },
      overrides: (task.overrides ?? []).filter((o) => o.originalDate < occurrence.originalDate),
      updatedAt: now,
    },
  ];
}

/** A copy of one occurrence as a plain (non-recurring) task. */
export function duplicateOccurrence(
  task: Task,
  occurrence: Occurrence,
  now: string,
  newId: string,
): Task {
  const { recurrence: _r, overrides: _o, completedAt: _c, ...rest } = task;
  return {
    ...rest,
    id: newId,
    title: occurrence.title,
    schedule: occurrence.schedule,
    status: "todo",
    createdAt: now,
    updatedAt: now,
  };
}
