import { availableListColors } from "./listColors";
import {
  addFolder,
  addNote,
  isNewsList,
  liveLists,
  liveNotes,
  SAVED_FOLDER,
  trashNote,
  type Note,
} from "./noghte/model";
import { records } from "./noghte/records";
import type { Story } from "./news";

/**
 * Saved stories are notes in a folder of their own, «خبرهای ذخیره‌شده» — a title, the summary and the
 * link — so they sync to the phone like any note. That folder holds notes only: the tasks, the
 * planner and every task picker, here and on the phone, leave it out (`isNewsList`).
 */
export { SAVED_FOLDER };

const folder = () => liveLists().find((l) => isNewsList(l));

/**
 * A saved-news folder that became the default list (it was the first list of a browser) gives the
 * default to «شخصی», or the first other list, so tasks and new notes never land in it. Run after
 * each sync; writes nothing once done.
 */
export function keepSavedFolderOffDefault(): void {
  const f = folder();
  if (f === undefined || !f.isDefault) return;
  const now = new Date().toISOString();
  records.write("list", f.id, { ...f, isDefault: false, updatedAt: now });
  const next =
    liveLists().find((l) => l.id !== f.id && l.name === "شخصی") ??
    liveLists().find((l) => l.id !== f.id);
  if (next !== undefined)
    records.write("list", next.id, { ...next, isDefault: true, updatedAt: now });
}

/** The saved stories' notes, newest first. */
export function savedNotes(): Note[] {
  const f = folder();
  return f === undefined ? [] : liveNotes().filter((n) => n.folderId === f.id);
}

/** The link a saved note carries (its last line that is an address). */
export const noteUrl = (n: Note): string | null => {
  for (const b of [...n.blocks].reverse()) {
    if ("text" in b && /^https:\/\//.test(b.text.trim())) return b.text.trim();
  }
  return null;
};

export const savedNoteOf = (url: string): Note | undefined =>
  savedNotes().find((n) => noteUrl(n) === url);

export function saveStory(s: Story): void {
  const f =
    folder() ??
    addFolder(SAVED_FOLDER, availableListColors(liveLists().map((l) => l.color))[0] ?? "#6FB6F2");
  addNote(s.title, `${s.summary}\n${s.url}`, f.id);
}

/** Saves the story, or takes it out again when it is saved. */
export function toggleSaved(s: Story): void {
  const n = savedNoteOf(s.url);
  if (n === undefined) saveStory(s);
  else trashNote(n, true);
}
