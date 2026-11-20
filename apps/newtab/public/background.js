/**
 * «ببند و در نقطه نگه دار» (2026-11-20, the user: «صفحه رو ببندیم ولی توی تسک ها نگهش داریم»):
 * an item in the page's right-click menu. The page goes into a small inbox in the extension's
 * storage and the tab closes; the new tab is the only writer of tasks, so it is the one that turns
 * what waits in the inbox into undated tasks (`src/noghte/inbox.ts`) the next time it opens — or at
 * once, when one is open.
 *
 * Plain JS on purpose: copied as is from `public/`, with nothing to import.
 */

const MENU = "noghte-close-keep";
const INBOX = "noghte.inbox.v1";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "update") void justUpdated(details.previousVersion);
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU,
      title: "ببند و در نقطه نگه دار",
      contexts: ["page"],
      documentUrlPatterns: ["http://*/*", "https://*/*"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU) return;
  void keepAndClose(info, tab);
});

async function keepAndClose(info, tab) {
  const url = info.pageUrl || tab?.url || "";
  if (!/^https?:\/\//i.test(url)) return;
  const title = (tab?.title || "").trim().slice(0, 200);
  const got = await chrome.storage.local.get(INBOX);
  const items = Array.isArray(got[INBOX]) ? got[INBOX] : [];
  items.push({ id: crypto.randomUUID(), url, title, at: new Date().toISOString() });
  // kept first: the tab closes only once the page is safely written down
  await chrome.storage.local.set({ [INBOX]: items });
  if (tab?.id !== undefined && tab.id >= 0) await chrome.tabs.remove(tab.id);
}

/*
 * Updates (2026-11-20, the user: «یا خودکار اپدیت بشه افزونه شون یا با یک دایالوگ متوجه بشن چطوری
 * اپدیتش کنن»). Chrome downloads a store update by itself but installs it only when the extension is
 * reloaded or the browser restarts. Here it is installed at once when no page of the extension is
 * open (reloading closes those pages, and with them anything half-typed); otherwise the new tab is
 * told (`update.ready`) and offers it, and it goes in as soon as the last such page closes.
 */

const READY = "update.ready";
const DONE = "update.done";

chrome.runtime.onUpdateAvailable.addListener((details) => {
  void chrome.storage.local.set({ [READY]: details.version }).then(applyIfIdle);
});

chrome.tabs.onRemoved.addListener(() => {
  void chrome.storage.local.get(READY).then((got) => {
    if (typeof got[READY] === "string") void applyIfIdle();
  });
});

async function applyIfIdle() {
  const open = await chrome.runtime.getContexts({ contextTypes: ["TAB"] });
  if (open.length === 0) chrome.runtime.reload();
}

async function justUpdated(from) {
  const to = chrome.runtime.getManifest().version;
  await chrome.storage.local.remove(READY);
  await chrome.storage.local.set({
    [DONE]: { from: from || null, to, at: new Date().toISOString() },
  });
}
