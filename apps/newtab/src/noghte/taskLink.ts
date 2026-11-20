/**
 * A web page kept on a task (2026-11-20, the user: «تب مرورگرش رو بده جزو تسک ها»). The task record
 * is the app's own (`@dotlife/tasks`, never edited here), so the page's address lives in what the
 * record already has: the first line of the task's notes, alone. The phone shows it as plain text
 * and syncs it untouched; this tab shows it as a site icon and opens it on a click.
 */

const LINK_LINE = /^https?:\/\/\S+$/i;

/** The page the notes begin with, or "". */
export function linkIn(notes: string): string {
  const first = notes.split(/\r?\n/, 1)[0]?.trim() ?? "";
  return LINK_LINE.test(first) ? first : "";
}

/** The notes without that first line (what the form shows in «یادداشت»). */
export function withoutLink(notes: string): string {
  if (linkIn(notes) === "") return notes;
  return notes.replace(/^[^\r\n]*\r?\n?/, "").replace(/^\s+/, "");
}

/** The person's text with the page's address on top (or just the text when there is none). */
export const withLink = (text: string, url: string): string =>
  [url.trim(), text.trim()].filter((s) => s !== "").join("\n\n");

/** What a person typed or pasted, as an address we keep: a full http(s) one, or "" when it is not. */
export function parseLink(input: string): string {
  const t = input.trim();
  if (t === "" || /\s/.test(t)) return "";
  const full = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(full);
    return u.hostname.includes(".") ? u.toString() : "";
  } catch {
    return "";
  }
}

/** «example.com/page» for showing. */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}
