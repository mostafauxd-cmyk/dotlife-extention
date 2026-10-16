/**
 * Opens one note on the notes slide from anywhere on the page (the quick panel's recent notes): the
 * slide hears it, selects the note, and the page scrolls there.
 */
const listeners = new Set<(id: string) => void>();

export function onOpenNote(l: (id: string) => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function openNote(id: string): void {
  for (const l of listeners) l(id);
  document.getElementById("s-notes")?.scrollIntoView({ behavior: "smooth" });
}
