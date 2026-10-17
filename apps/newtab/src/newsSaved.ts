import { availableListColors } from "./listColors";
import { addFolder, addNote, liveLists, liveNotes, trashNote, type Note } from "./noghte/model";
import type { Story } from "./news";

/**
 * Saved stories are notes in a folder of their own, «خبرهای ذخیره‌شده» — a title, the summary and the
 * link — so they sync to the phone like any note, and need nothing new there.
 */
export const SAVED_FOLDER = "خبرهای ذخیره‌شده";

const folder = () => liveLists().find((l) => l.name === SAVED_FOLDER);

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
