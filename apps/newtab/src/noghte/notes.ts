import { fromJdn, MONTH_NAMES_FA, WEEKDAY_NAMES_FA, weekdayOfJdn } from "@dotlife/calendar-core";
import { dateToJdn, type LocalDate } from "@dotlife/tasks";

/**
 * A copy of dotlife `apps/mobile/src/notes/model.ts` (with its tests in `test/notes.test.ts`), so a
 * note edited here splits, joins and changes kind exactly as on the phone. Keep the two in step.
 *
 * Notes (step 11‌ب) — after Apple Notes: a note is a column of blocks. The first block is the title;
 * the rest are body text, headings, bullets or checklist items. Pure, so it is unit-tested; the
 * store and the screens only call these.
 */

export type BlockKind = "title" | "heading" | "text" | "bullet" | "check" | "voice";

/**
 * The written-out words of a voice recording (2026-10-11): asked of an AI service once one is
 * connected (`transcribe.ts`). `pending` was asked and not answered; `failed` can be asked again.
 */
export type Transcript = { status: "pending" | "done" | "failed"; text?: string };

/**
 * A voice recording in a note. `file` is the recording's name in the notes' voice folder on this
 * phone (on web, a blob URL that lasts the session). `peaks` are 0–1 loudness bars, drawn as its wave.
 */
export type Voice = { file: string; durationMs: number; peaks: number[]; transcript?: Transcript };

/** A voice block keeps `text` empty; its words live in `voice.transcript`. */
export type Block = { id: string; kind: BlockKind; text: string; done?: boolean; voice?: Voice };

export type Note = {
  id: string;
  folderId: string;
  blocks: Block[];
  pinned: boolean;
  /** A day this note belongs to (ISO Gregorian, shown in Solar Hijri). */
  day?: LocalDate;
  /** A task this note is about. */
  taskId?: string;
  createdAt: string;
  updatedAt: string;
  /** In «حذف‌شده‌ها» since then; purged after `TRASH_DAYS`. */
  deletedAt?: string;
};

export type Folder = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export const TRASH_DAYS = 30;

/** Kinds whose Enter starts another block of the same kind (a list continues). */
export const LIST_KINDS: ReadonlySet<BlockKind> = new Set(["bullet", "check"]);

const textOf = (b: Block): string => b.text.trim();

/** The words a block holds: its text, or a voice's transcript. */
const wordsOf = (b: Block): string =>
  b.kind === "voice" ? (b.voice?.transcript?.text ?? "") : b.text;

/** A note with nothing written or recorded in it — discarded when its editor closes. */
export const isEmptyNote = (note: Note): boolean =>
  note.blocks.every((b) => b.kind !== "voice" && textOf(b) === "");

/** The note's voice recordings. */
export const voicesOf = (note: Note): Voice[] =>
  note.blocks.flatMap((b) => (b.kind === "voice" && b.voice !== undefined ? [b.voice] : []));

/** How much of a text line stands in for a missing title. */
const TITLE_CUT = 36;

/**
 * The first written line: the note's title, as in Apple Notes. A note with no title (a quick note
 * from the composer is plain text) shows a short cut of its first line instead.
 */
export function noteTitle(note: Note): string {
  const first = note.blocks.find((b) => textOf(b) !== "");
  if (first === undefined) return voicesOf(note).length > 0 ? "یادداشت صوتی" : "یادداشت تازه";
  const line = firstLine(first.text);
  if (first.kind === "title" || line.length <= TITLE_CUT) return line;
  return `${line.slice(0, TITLE_CUT).trimEnd()}…`;
}

/** The line after the title, for the list's second row. */
export function notePreview(note: Note): string {
  const written = note.blocks.filter((b) => textOf(b) !== "");
  const lines = written.flatMap((b) =>
    b.text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== ""),
  );
  return lines[1] ?? "";
}

/** Checklist progress, for the list row: «۲ از ۵». Null when the note has no checklist. */
export function checklistProgress(note: Note): { done: number; total: number } | null {
  const items = note.blocks.filter((b) => b.kind === "check" && textOf(b) !== "");
  if (items.length === 0) return null;
  return { done: items.filter((b) => b.done === true).length, total: items.length };
}

const firstLine = (s: string): string => s.trim().split("\n")[0]?.trim() ?? "";

// ── searching ────────────────────────────────────────────────────────────────

/** Arabic/Persian letter variants, ZWNJ and case folded away so «يادداشت» finds «یادداشت». */
export function normalize(s: string): string {
  return s
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[\u200C\u200E\u200F]|\p{Mn}/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/** Notes whose text holds every word of `query`, newest first. */
export function searchNotes(notes: readonly Note[], query: string): Note[] {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return [];
  return byUpdated(
    notes.filter((n) => {
      const hay = normalize(n.blocks.map(wordsOf).join(" "));
      return words.every((w) => hay.includes(w));
    }),
  );
}

// ── the list's sections ──────────────────────────────────────────────────────

export type NoteSection = { key: string; title: string; notes: Note[] };

export const byUpdated = (notes: readonly Note[]): Note[] =>
  [...notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));

/**
 * «سنجاق‌شده»، «امروز»، «دیروز»، «۷ روز گذشته»، «۳۰ روز گذشته», then one section per Solar month
 * (with the year when it is not this year) — Apple Notes' grouping in the Solar calendar.
 * `dayOf` turns an ISO instant into the local day it fell on.
 */
export function groupNotes(
  notes: readonly Note[],
  today: LocalDate,
  dayOf: (iso: string) => LocalDate,
): NoteSection[] {
  const t = dateToJdn(today);
  const thisYear = fromJdn(t, "solar-hijri").year;
  const sections: NoteSection[] = [];
  const add = (key: string, title: string, note: Note): void => {
    const last = sections.find((s) => s.key === key);
    if (last === undefined) sections.push({ key, title, notes: [note] });
    else last.notes.push(note);
  };
  const sorted = byUpdated(notes);
  const pinned = sorted.filter((n) => n.pinned);
  if (pinned.length > 0) sections.push({ key: "pinned", title: "سنجاق‌شده", notes: pinned });
  for (const n of sorted) {
    if (n.pinned) continue;
    const j = dateToJdn(dayOf(n.updatedAt));
    const ago = t - j;
    if (ago <= 0) add("today", "امروز", n);
    else if (ago === 1) add("yesterday", "دیروز", n);
    else if (ago < 7) add("week", "۷ روز گذشته", n);
    else if (ago < 30) add("month", "۳۰ روز گذشته", n);
    else {
      const s = fromJdn(j, "solar-hijri");
      const name = MONTH_NAMES_FA["solar-hijri"][s.month - 1] ?? "";
      add(
        `${String(s.year)}-${String(s.month)}`,
        s.year === thisYear ? name : `${name} ${String(s.year)}`,
        n,
      );
    }
  }
  return sections;
}

/**
 * The date on a list row: the time today, «دیروز», the weekday within a week, else «۱۲ شهریور»
 * (with the year when it is not this year). `local` is the instant's local day and time.
 */
export function rowDate(local: { date: LocalDate; time: string }, today: LocalDate): string {
  const j = dateToJdn(local.date);
  const t = dateToJdn(today);
  const ago = t - j;
  if (ago <= 0) return local.time;
  if (ago === 1) return "دیروز";
  if (ago < 7) return WEEKDAY_NAMES_FA[weekdayOfJdn(j)] ?? "";
  return solarDay(local.date, fromJdn(t, "solar-hijri").year);
}

/** «۱۲ شهریور», with the year unless it is `thisYear`. */
export function solarDay(date: LocalDate, thisYear?: number): string {
  const s = fromJdn(dateToJdn(date), "solar-hijri");
  const base = `${String(s.day)} ${MONTH_NAMES_FA["solar-hijri"][s.month - 1] ?? ""}`;
  return s.year === thisYear ? base : `${base} ${String(s.year)}`;
}

// ── editing blocks ───────────────────────────────────────────────────────────

/** Where the caret should land after an edit: a block and an offset in its text. */
export type Caret = { id: string; at: number };

/**
 * Enter at `at` in block `index`: the rest of the line moves to a new block below — body text after a
 * title, heading or text; the same kind in a list. Enter on an empty list item leaves the list
 * instead (Apple Notes).
 */
export function splitBlock(
  blocks: readonly Block[],
  index: number,
  at: number,
  newId: () => string,
): { blocks: Block[]; caret: Caret } {
  const b = blocks[index];
  if (b === undefined) return { blocks: [...blocks], caret: { id: "", at: 0 } };
  if (LIST_KINDS.has(b.kind) && b.text.trim() === "") {
    const plain: Block = { id: b.id, kind: "text", text: "" };
    return { blocks: replaceAt(blocks, index, [plain]), caret: { id: b.id, at: 0 } };
  }
  const before = b.text.slice(0, at);
  const after = b.text.slice(at);
  const kind: BlockKind = LIST_KINDS.has(b.kind) ? b.kind : "text";
  const next: Block = {
    id: newId(),
    kind,
    text: after,
    ...(kind === "check" ? { done: false } : {}),
  };
  return {
    blocks: replaceAt(blocks, index, [{ ...b, text: before }, next]),
    caret: { id: next.id, at: 0 },
  };
}

/**
 * Backspace at the very start of block `index`. A list item or heading first turns into plain
 * text; plain text joins the block above (the title is never removed).
 */
export function joinBackward(
  blocks: readonly Block[],
  index: number,
): { blocks: Block[]; caret: Caret } | null {
  const b = blocks[index];
  if (b === undefined || index === 0) return null;
  if (b.kind !== "text") {
    return {
      blocks: replaceAt(blocks, index, [{ id: b.id, kind: "text", text: b.text }]),
      caret: { id: b.id, at: 0 },
    };
  }
  const prev = blocks[index - 1];
  if (prev === undefined) return null;
  // a recording above is never joined into: an empty line under it goes, the caret to the line above it
  if (prev.kind === "voice") {
    const above = blocks[index - 2];
    if (b.text !== "" || above === undefined) return null;
    const out = [...blocks];
    out.splice(index, 1);
    return { blocks: out, caret: { id: above.id, at: above.text.length } };
  }
  const joined: Block = { ...prev, text: prev.text + b.text };
  const out = [...blocks];
  out.splice(index - 1, 2, joined);
  return { blocks: out, caret: { id: prev.id, at: prev.text.length } };
}

/**
 * The format bar on block `index`. On the title, a list kind adds a fresh item below instead of
 * turning the title into one. Choosing the kind it already has turns a list item back into text.
 */
export function setKind(
  blocks: readonly Block[],
  index: number,
  kind: BlockKind,
  newId: () => string,
): { blocks: Block[]; caret: Caret } {
  const b = blocks[index];
  if (b === undefined) return { blocks: [...blocks], caret: { id: "", at: 0 } };
  if (index === 0 && kind !== "title") {
    const item: Block = {
      id: newId(),
      kind,
      text: "",
      ...(kind === "check" ? { done: false } : {}),
    };
    return {
      blocks: [...blocks.slice(0, 1), item, ...blocks.slice(1)],
      caret: { id: item.id, at: 0 },
    };
  }
  const target: BlockKind = b.kind === kind && LIST_KINDS.has(kind) ? "text" : kind;
  const next: Block = { id: b.id, kind: target, text: b.text };
  if (target === "check") next.done = b.done ?? false;
  return { blocks: replaceAt(blocks, index, [next]), caret: { id: b.id, at: b.text.length } };
}

export function toggleDone(blocks: readonly Block[], id: string): Block[] {
  return blocks.map((b) =>
    b.id === id && b.kind === "check" ? { ...b, done: b.done !== true } : b,
  );
}

export function setText(blocks: readonly Block[], id: string, text: string): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, text } : b));
}

/** Notes in the trash longer than `days` (set in «یادداشت‌ها», 30 by default) are gone for good. */
export function expired(note: Note, now: Date, days: number = TRASH_DAYS): boolean {
  if (note.deletedAt === undefined) return false;
  return now.getTime() - Date.parse(note.deletedAt) > days * 86_400_000;
}

const replaceAt = (blocks: readonly Block[], index: number, items: Block[]): Block[] => [
  ...blocks.slice(0, index),
  ...items,
  ...blocks.slice(index + 1),
];

// ── loading ──────────────────────────────────────────────────────────────────

const KINDS: ReadonlySet<string> = new Set([
  "title",
  "heading",
  "text",
  "bullet",
  "check",
  "voice",
]);
const isStr = (v: unknown): v is string => typeof v === "string";
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function asBlock(v: unknown): Block | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.text) || !isStr(v.kind) || !KINDS.has(v.kind))
    return null;
  const b: Block = { id: v.id, kind: v.kind as BlockKind, text: v.text };
  if (b.kind === "check") b.done = v.done === true;
  if (b.kind === "voice") {
    const voice = asVoice(v.voice);
    if (voice === null) return null;
    b.voice = voice;
  }
  return b;
}

function asVoice(v: unknown): Voice | null {
  if (!isObj(v) || !isStr(v.file) || typeof v.durationMs !== "number") return null;
  const peaks = Array.isArray(v.peaks)
    ? v.peaks
        .filter((p): p is number => typeof p === "number")
        .map((p) => Math.min(1, Math.max(0, p)))
    : [];
  const voice: Voice = { file: v.file, durationMs: Math.max(0, v.durationMs), peaks };
  const t = v.transcript;
  if (isObj(t) && (t.status === "pending" || t.status === "done" || t.status === "failed")) {
    voice.transcript = isStr(t.text) ? { status: t.status, text: t.text } : { status: t.status };
  }
  return voice;
}

/** A stored note, checked field by field; anything malformed is dropped rather than crashing. */
export function asNote(v: unknown): Note | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.folderId) || !Array.isArray(v.blocks)) return null;
  if (!isStr(v.createdAt) || !isStr(v.updatedAt)) return null;
  const blocks = v.blocks.map(asBlock).filter((b): b is Block => b !== null);
  if (blocks.length === 0) return null;
  const n: Note = {
    id: v.id,
    folderId: v.folderId,
    blocks,
    pinned: v.pinned === true,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
  if (isStr(v.day)) n.day = v.day;
  if (isStr(v.taskId)) n.taskId = v.taskId;
  if (isStr(v.deletedAt)) n.deletedAt = v.deletedAt;
  return n;
}

export function asFolder(v: unknown): Folder | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name)) return null;
  if (!isStr(v.createdAt) || !isStr(v.updatedAt)) return null;
  return {
    id: v.id,
    name: v.name,
    isDefault: v.isDefault === true,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/** The note as plain text, for sharing: lists keep their marks. */
export function noteAsText(note: Note): string {
  return note.blocks
    .filter((b, i) => i === 0 || b.text.trim() !== "" || b.kind === "text" || b.kind === "voice")
    .map((b) =>
      b.kind === "voice"
        ? voiceAsText(b.voice)
        : b.kind === "check"
          ? `${b.done === true ? "☑" : "☐"} ${b.text}`
          : b.kind === "bullet"
            ? `• ${b.text}`
            : b.text,
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function voiceAsText(voice: Voice | undefined): string {
  if (voice === undefined) return "";
  const said = voice.transcript?.status === "done" ? (voice.transcript.text ?? "").trim() : "";
  const head = `🎙 یادداشت صوتی (${clock(voice.durationMs)})`;
  return said === "" ? head : `${head}\n${said}`;
}

// ── voice ────────────────────────────────────────────────────────────────────

/** «۴:۰۷» — minutes and seconds, as a clock reads (left to right). */
export function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`;
}

/** A meter reading (dBFS, −160…0) as a 0–1 bar: speech sits in the upper half, silence near zero. */
export function levelOf(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  const FLOOR = -50;
  const x = (Math.min(0, Math.max(FLOOR, db)) - FLOOR) / -FLOOR;
  return Math.round(x ** 1.6 * 1000) / 1000;
}

/** `peaks` resampled to `n` bars (the loudest in each stretch), for drawing at any width. */
export function resample(peaks: readonly number[], n: number): number[] {
  if (n <= 0) return [];
  if (peaks.length === 0) return new Array<number>(n).fill(0);
  return Array.from({ length: n }, (_, i) => {
    const from = Math.floor((i * peaks.length) / n);
    const to = Math.max(from + 1, Math.floor(((i + 1) * peaks.length) / n));
    let max = 0;
    for (let j = from; j < to && j < peaks.length; j++) max = Math.max(max, peaks[j] ?? 0);
    return max;
  });
}

/**
 * Bars as one SVG path of round-capped vertical strokes (drawn with stroke width `bar`): bar `i` of
 * `levels` at x = `x0 + i·step`, centred in `height`, never shorter than a dot.
 */
export function barsPath(
  levels: readonly number[],
  { x0 = 0, step, bar, height }: { x0?: number; step: number; bar: number; height: number },
): string {
  const mid = height / 2;
  const room = height - bar;
  return levels
    .map((p, i) => {
      const half = Math.max(0.01, (Math.min(1, Math.max(0, p)) * room) / 2);
      const x = Math.round((x0 + i * step + bar / 2) * 100) / 100;
      return `M${String(x)} ${String(Math.round((mid - half) * 100) / 100)}V${String(Math.round((mid + half) * 100) / 100)}`;
    })
    .join("");
}

/**
 * A recording dropped in at the line being written (`at`, a block index; null = the end of the note).
 * An empty body line keeps its place under the recording, so writing goes on right after it; a
 * recording that would end the note gets an empty line after it for the same reason.
 */
export function insertVoice(
  blocks: readonly Block[],
  at: number | null,
  voice: Voice,
  newId: () => string,
): { blocks: Block[]; id: string } {
  const block: Block = { id: newId(), kind: "voice", text: "", voice };
  let index = at === null ? blocks.length - 1 : Math.min(Math.max(0, at), blocks.length - 1);
  const here = blocks[index];
  // an empty last line (a fresh note's body, the line after a list) takes the recording above it
  const emptyHere = here !== undefined && index > 0 && here.kind === "text" && here.text === "";
  const out = [...blocks];
  if (emptyHere) out.splice(index, 0, block);
  else {
    index += 1;
    out.splice(index, 0, block);
    if (index === out.length - 1) out.push({ id: newId(), kind: "text", text: "" });
  }
  return { blocks: out, id: block.id };
}

export function removeBlock(blocks: readonly Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id);
}

/** A voice block's transcript set (or cleared with null). */
export function setTranscript(
  blocks: readonly Block[],
  id: string,
  transcript: Transcript | null,
): Block[] {
  return blocks.map((b) => {
    if (b.id !== id || b.voice === undefined) return b;
    const { transcript: _old, ...voice } = b.voice;
    return { ...b, voice: transcript === null ? voice : { ...voice, transcript } };
  });
}

/** A transcript's paragraphs written into the note as text lines under the recording. */
export function transcriptIntoNote(
  blocks: readonly Block[],
  id: string,
  newId: () => string,
): { blocks: Block[]; caret: Caret } | null {
  const index = blocks.findIndex((b) => b.id === id);
  const said = blocks[index]?.voice?.transcript?.text?.trim() ?? "";
  if (index < 0 || said === "") return null;
  const lines: Block[] = said
    .split(/\n\s*\n|\n/)
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .map((text) => ({ id: newId(), kind: "text", text }));
  const out = [...blocks];
  out.splice(index + 1, 0, ...lines);
  const last = lines[lines.length - 1];
  return { blocks: out, caret: { id: last?.id ?? id, at: last?.text.length ?? 0 } };
}

/** Notes linked to a day, newest first (the calendar's day card). */
export const notesForDay = (notes: readonly Note[], day: LocalDate): Note[] =>
  byUpdated(notes.filter((n) => n.deletedAt === undefined && n.day === day));

/** Notes linked to a task, newest first (the task sheet, the task row's mark). */
export const notesForTask = (notes: readonly Note[], taskId: string): Note[] =>
  byUpdated(notes.filter((n) => n.deletedAt === undefined && n.taskId === taskId));

// ── folders are task lists ───────────────────────────────────────────────────

/** What the notes need of a task list (folders and lists are one since 2026-10-06). */
export type ListRef = { id: string; name: string; isDefault: boolean };

/**
 * Where each old notes folder goes now that folders are task lists: the default folder to the
 * default list, a folder whose name a list already has to that list. The rest are `missing` — the
 * caller makes a list for each and adds it to `map`.
 */
export function folderMapping(
  folders: readonly Folder[],
  lists: readonly ListRef[],
): { map: Map<string, string>; missing: Folder[] } {
  const map = new Map<string, string>();
  const missing: Folder[] = [];
  const home = lists.find((l) => l.isDefault) ?? lists[0];
  for (const f of folders) {
    const same = lists.find((l) => normalize(l.name) === normalize(f.name));
    if (f.isDefault && home !== undefined) map.set(f.id, home.id);
    else if (same !== undefined) map.set(f.id, same.id);
    else missing.push(f);
  }
  return { map, missing };
}

/**
 * Each note's list: its own when that list is live, else where its old folder went (`map`), else
 * the default list — so no note is ever left without a home.
 */
export function repoint(
  notes: readonly Note[],
  map: ReadonlyMap<string, string>,
  liveIds: ReadonlySet<string>,
  defaultId: string,
): Note[] {
  return notes.map((n) => {
    if (liveIds.has(n.folderId)) return n;
    const to = map.get(n.folderId);
    return { ...n, folderId: to !== undefined && liveIds.has(to) ? to : defaultId };
  });
}
