import { inExtension, load, save } from "../platform";
import { addTask } from "./model";
import { withLink } from "./taskLink";

/**
 * Pages closed with «ببند و در نقطه نگه دار» (`public/background.js`) wait here until a new tab
 * makes them tasks: undated, in the default list, the page's address on the first line of the
 * notes (`taskLink.ts`). Only the new tab writes tasks, so the service worker never races the
 * records this page holds. Several new tabs may be open: a Web Lock lets one of them take the inbox.
 */

const INBOX = "noghte.inbox.v1";

export type Kept = { id: string; url: string; title: string; at: string };

/** The task title for a kept page: its title, or else its address without the scheme. */
export function keptTitle(k: Pick<Kept, "url" | "title">): string {
  const t = k.title.trim();
  if (t !== "") return t.slice(0, 200);
  return k.url
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .slice(0, 200);
}

async function drain(): Promise<void> {
  const items = await load<Kept[]>(INBOX);
  if (!Array.isArray(items) || items.length === 0) return;
  for (const k of items) {
    if (typeof k.url !== "string" || !/^https?:\/\//i.test(k.url)) continue;
    addTask(keptTitle(k), { day: null, notes: withLink("", k.url) });
  }
  // only what was read goes: a page kept meanwhile stays for the next round
  const now = (await load<Kept[]>(INBOX)) ?? [];
  const taken = new Set(items.map((k) => k.id));
  await save(
    INBOX,
    now.filter((k) => !taken.has(k.id)),
  );
}

function drainOnce(): void {
  if (typeof navigator.locks === "undefined") {
    void drain();
    return;
  }
  void navigator.locks.request("noghte-inbox", () => drain());
}

/** Takes what waits now, and whatever is kept while this tab is open. */
export function watchInbox(): void {
  if (!inExtension) return;
  drainOnce();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && INBOX in changes) drainOnce();
  });
}
