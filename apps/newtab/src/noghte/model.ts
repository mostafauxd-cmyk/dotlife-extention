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

/** A task drawn on the planner: from one time to another on a day, as the app's planner makes it. */
export function addTimedTask(title: string, day: LocalDate, start: string, end: string): Task {
  const lists = liveLists();
  const tasks = records.all<Task>("task");
  const last = tasks.reduce<string | undefined>(
    (max, t) => (max === undefined || t.order > max ? t.order : max),
    undefined,
  );
  const now = nowIso();
  const task: Task = {
    id: newId(),
    listId: (defaultList(lists) ?? ensureDefaultList()).id,
    title: title.trim(),
    status: "todo",
    priority: "none",
    schedule: { kind: "range", start: { date: day, time: start }, end: { date: day, time: end } },
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

/** Every note, the trashed ones too («حذف‌شده‌ها»). */
export const allNotes = (): Note[] => records.all<Note>("note");

/** A note changed in the notes slide, written whole with a fresh `updatedAt`. */
export function saveNote(note: Note): Note {
  const next = { ...note, updatedAt: nowIso() };
  records.write("note", next.id, next);
  return next;
}

/** An empty note in a folder (or the default one): a blank title, as the app's «یادداشت تازه». */
export function newNote(folderId?: string): Note {
  const lists = liveLists();
  const now = nowIso();
  const list = lists.find((l) => l.id === folderId) ?? defaultList(lists) ?? ensureDefaultList();
  const note: Note = {
    id: newId(),
    folderId: list.id,
    blocks: [{ id: newId(), kind: "title", text: "" }],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  records.write("note", note.id, note);
  return note;
}

/** To «حذف‌شده‌ها», or back from it; the app empties it after 30 days. */
export const trashNote = (note: Note, trashed: boolean): Note =>
  saveNote(
    trashed ? { ...note, deletedAt: nowIso() } : (({ deletedAt: _gone, ...rest }) => rest)(note),
  );

/** A new folder: notes folders are task lists, so it is a list, last in order. */
export function addFolder(name: string, color: string): TaskList {
  const lists = liveLists();
  const now = nowIso();
  const last = lists.at(-1)?.order;
  const list: TaskList = {
    id: newId(),
    name: name.trim(),
    color,
    order: last === undefined ? FIRST_ORDER : orderBetween(last, undefined),
    isDefault: lists.length === 0,
    createdAt: now,
    updatedAt: now,
  };
  records.write("list", list.id, list);
  return list;
}

/**
 * After signing in, lists written here while signed out sit beside the account's own. One the
 * account already has — its default «شخصی», or one of the same name — is folded into it: its tasks
 * and notes move over and it goes away, so the person never sees two of the same.
 */
export function foldTakenLists(taken: readonly string[]): void {
  if (taken.length === 0) return;
  const lists = liveLists();
  const now = nowIso();
  const same = (a: string, b: string): boolean => a.trim() === b.trim();
  for (const id of taken) {
    const mine = lists.find((l) => l.id === id);
    if (mine === undefined) continue;
    const theirs = lists.find(
      (l) => !taken.includes(l.id) && ((mine.isDefault && l.isDefault) || same(l.name, mine.name)),
    );
    if (theirs === undefined) continue;
    for (const t of records.all<Task>("task"))
      if (t.listId === mine.id)
        records.write("task", t.id, { ...t, listId: theirs.id, updatedAt: now });
    for (const n of records.all<Note>("note"))
      if (n.folderId === mine.id)
        records.write("note", n.id, { ...n, folderId: theirs.id, updatedAt: now });
    records.write("list", mine.id, { ...mine, deletedAt: now, updatedAt: now });
  }
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
