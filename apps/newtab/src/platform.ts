/**
 * What the new tab needs from Chrome: storage, the default search engine, site icons, bookmarks and
 * most-visited sites. Outside the extension (the Vite preview), each falls back to the plain web so
 * the page still runs: localStorage, a Google URL, Google's favicon service, and no bookmarks.
 */

// `chrome` exists in every Chrome page; only the extension's own pages have a runtime id
export const inExtension =
  typeof chrome !== "undefined" &&
  typeof (chrome as { runtime?: { id?: string } }).runtime?.id === "string";

// ---- storage ----

export async function load<T>(key: string): Promise<T | undefined> {
  if (inExtension) {
    const got = await chrome.storage.local.get(key);
    return got[key] as T | undefined;
  }
  const raw = localStorage.getItem(key);
  return raw === null ? undefined : (JSON.parse(raw) as T);
}

export async function save(key: string, value: unknown): Promise<void> {
  if (inExtension) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

export async function remove(key: string): Promise<void> {
  if (inExtension) {
    await chrome.storage.local.remove(key);
    return;
  }
  localStorage.removeItem(key);
}

// ---- search ----

/** A typed address opens as is; anything else goes to the user's default search engine. */
export function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (/\s/.test(t) || t.length < 4) return false;
  return /^https?:\/\//i.test(t) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(t);
}

export function search(text: string): void {
  const t = text.trim();
  if (t === "") return;
  if (looksLikeUrl(t)) {
    location.href = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    return;
  }
  if (inExtension) {
    void chrome.search.query({ text: t, disposition: "CURRENT_TAB" });
    return;
  }
  location.href = `https://www.google.com/search?q=${encodeURIComponent(t)}`;
}

// ---- sites ----

/** The site's own icon, as Chrome already has it (permission `favicon`): nothing is fetched. */
export function faviconUrl(pageUrl: string, size = 64): string {
  if (inExtension) {
    const u = new URL(chrome.runtime.getURL("/_favicon/"));
    u.searchParams.set("pageUrl", pageUrl);
    u.searchParams.set("size", String(size));
    return u.toString();
  }
  return `https://www.google.com/s2/favicons?sz=${String(size)}&domain_url=${encodeURIComponent(pageUrl)}`;
}

export type Site = { title: string; url: string };

export async function topSites(): Promise<Site[]> {
  if (!inExtension) return [];
  const sites = await chrome.topSites.get();
  return sites.map((s) => ({ title: s.title, url: s.url }));
}

export type Bookmark = { id: string; title: string; url?: string; children?: Bookmark[] };

/** The bookmarks bar, as folders and links. */
export async function bookmarksBar(): Promise<Bookmark[]> {
  if (!inExtension) return [];
  const [root] = await chrome.bookmarks.getTree();
  const bar = root?.children?.[0];
  const map = (n: chrome.bookmarks.BookmarkTreeNode): Bookmark => ({
    id: n.id,
    title: n.title,
    ...(n.url !== undefined ? { url: n.url } : {}),
    ...(n.children !== undefined ? { children: n.children.map(map) } : {}),
  });
  return (bar?.children ?? []).map(map);
}

/** A short, readable name for a site from its address («www.digikala.com» → «digikala»). */
export function siteName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0] ?? host;
  } catch {
    return url;
  }
}
