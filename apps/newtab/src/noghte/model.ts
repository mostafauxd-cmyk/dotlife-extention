import {
  complete,
  completeOccurrence,
  FIRST_ORDER,
  localNow,
  orderBetween,
  overdue,
  tasksOnDay,
  uncomplete,
  uncompleteOccurrence,
  unscheduled,
  uuidv7,
  type LocalDate,
  type Occurrence,
  type Task,
  type TaskList,
} from "@dotlife/tasks";

import { records } from "./records";

/**
 * نقطه's lists, tasks and notes as this tab shows and changes them. The records are the app's own
 * (`@dotlife/tasks` for lists and tasks, the notes model of `apps/mobile/src/notes/model.ts`); a
 * change made here is written whole, as the phone would write it, and synced.
 */

/** The app's tasks keep Tehran's clock (dotlife `TASK_TIME_ZONE`). */
export const TIME_ZONE = "Asia/Tehran";

// ---- notes: the shape of dotlife apps/mobile/src/notes/model.ts ----

export type BlockKind = "title" | "heading" | "text" | "bullet" | "check" | "voice";
export type Voice = {
  file: string;
  durationMs: number;
  peaks: number[];
  transcript?: { status: "pending" | "done" | "failed"; text?: string };
};
export type Block = { id: string; kind: BlockKind; text: string; done?: boolean; voice?: Voice };
export type Note = {
  id: string;
  /** The task list this note sits in (notes folders are task lists). */
  folderId: string;
  blocks: Block[];
  pinned: boolean;
  day?: LocalDate;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export const newId = (): string => uuidv7();
const nowIso = (): string => new Date().toISOString();
export const today = (): LocalDate => localNow(TIME_ZONE).date;

// ---- reading ----

export function liveLists(): TaskList[] {
  return records
    .all<TaskList>("list")
    .filter((l) => l.deletedAt === undefined)
    .sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
}

export const defaultList = (lists: readonly TaskList[]): TaskList | undefined =>
  lists.find((l) => l.isDefault) ?? lists[0];

export function liveTasks(): Task[] {
  return records.all<Task>("task").filter((t) => t.deletedAt === undefined);
}

export type TodayRow = { occurrence: Occurrence | null; task: Task; late: boolean };

/**
 * The «کارهای امروز» corner: late ones first, then today's (timed ones in time order), then a few
 * without a date — the same three groups the app's own today section has.
 */
export function todayRows(tasks: readonly Task[], max = 6): TodayRow[] {
  const now = localNow(TIME_ZONE);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const rows: TodayRow[] = [];
  const seen = new Set<string>();
  const add = (o: Occurrence, late: boolean): void => {
    const task = byId.get(o.taskId);
    const key = `${o.taskId}@${o.originalDate}`;
    if (task === undefined || seen.has(key)) return;
    seen.add(key);
    rows.push({ occurrence: o, task, late });
  };
  for (const o of overdue(tasks, now)) add(o, true);
  for (const o of tasksOnDay(tasks, now.date)) add(o, false);
  for (const t of unscheduled(tasks).sort((a, b) => (a.order < b.order ? -1 : 1))) {
    if (rows.length >= max) break;
    if (t.status === "todo") rows.push({ occurrence: null, task: t, late: false });
  }
  return rows.slice(0, max);
}

export const isDone = (r: TodayRow): boolean => (r.occurrence?.status ?? r.task.status) === "done";

export function liveNotes(): Note[] {
  return records
    .all<Note>("note")
    .filter((n) => n.deletedAt === undefined)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export const noteTitle = (n: Note): string =>
  n.blocks.find((b) => b.kind === "title")?.text.trim() ?? "";

/** The first words of a note after its title (or a voice's transcript), for a preview line. */
export function noteSnippet(n: Note): string {
  for (const b of n.blocks) {
    if (b.kind === "title") continue;
    const t = b.kind === "voice" ? (b.voice?.transcript?.text ?? "") : b.text;
    if (t.trim() !== "") return t.trim();
  }
  return "";
}

// ---- writing ----

/** A new task, as the app makes one: in the chosen list (or the default), last in order. */
export function addTask(
  title: string,
  opts: { listId?: string; day?: LocalDate | null } = {},
): Task {
  const lists = liveLists();
  const tasks = records.all<Task>("task");
  const last = tasks.reduce<string | undefined>(
    (max, t) => (max === undefined || t.order > max ? t.order : max),
    undefined,
  );
  const now = nowIso();
  const list = lists.find((l) => l.id === opts.listId) ?? defaultList(lists);
  const day = opts.day === undefined ? today() : opts.day;
  const task: Task = {
    id: newId(),
    listId: list?.id ?? ensureDefaultList().id,
    title: title.trim(),
    status: "todo",
    priority: "none",
    schedule: day === null ? { kind: "none" } : { kind: "due", due: { date: day } },
    timeZone: TIME_ZONE,
    reminders: [],
    order: last === undefined ? FIRST_ORDER : orderBetween(last, undefined),
    createdAt: now,
    updatedAt: now,
  };
  records.write("task", task.id, task);
  return task;
}

/** Ticks a task (or one occurrence of a repeating one) on or off. */
export function toggleTask(row: TodayRow): void {
  const now = nowIso();
  const done = isDone(row);
  const t = row.task;
  const o = row.occurrence;
  const next =
    o !== null && o.recurring
      ? done
        ? uncompleteOccurrence(t, o.originalDate, now)
        : completeOccurrence(t, o.originalDate, now)
      : done
        ? uncomplete(t, now)
        : complete(t, now);
  records.write("task", next.id, next);
}

/** A new note: the title block, then the body as text blocks, one per line. */
export function addNote(title: string, body: string, listId?: string): Note {
  const lists = liveLists();
  const now = nowIso();
  const list = lists.find((l) => l.id === listId) ?? defaultList(lists) ?? ensureDefaultList();
  const lines = body.split("\n").filter((l) => l.trim() !== "");
  const note: Note = {
    id: newId(),
    folderId: list.id,
    blocks: [
      { id: newId(), kind: "title", text: title.trim() },
      ...(lines.length === 0
        ? [{ id: newId(), kind: "text" as const, text: "" }]
        : lines.map((text) => ({ id: newId(), kind: "text" as const, text }))),
    ],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  records.write("note", note.id, note);
  return note;
}

/**
 * An account with no lists yet (never opened the app): the same «شخصی» default list the app makes
 * first, so a task or note written here has a home.
 */
function ensureDefaultList(): TaskList {
  const now = nowIso();
  const list: TaskList = {
    id: newId(),
    name: "شخصی",
    color: "#5AB0FF",
    order: FIRST_ORDER,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };
  records.write("list", list.id, list);
  return list;
}
