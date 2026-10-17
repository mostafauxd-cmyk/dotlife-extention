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

const SUGGEST =
  "https://suggestqueries.google.com/complete/search?client=chrome&hl=fa&ie=utf-8&oe=utf-8";
const suggested = new Map<string, string[]>();
let jsonp = 0;

/**
 * Google's suggestions for what is typed, the same list Chrome's address bar shows (permission
 * `suggestqueries.google.com`). The dev page has no such permission, so it asks through a script tag.
 */
export async function suggest(text: string): Promise<string[]> {
  const q = text.trim();
  if (q === "") return [];
  const kept = suggested.get(q);
  if (kept !== undefined) return kept;
  const url = `${SUGGEST}&q=${encodeURIComponent(q)}`;
  let list: string[] = [];
  try {
    const data: unknown = inExtension
      ? await fetch(url).then((r) => r.json())
      : await new Promise((done) => {
          const name = `__suggest${String(++jsonp)}`;
          const tag = document.createElement("script");
          const end = (v: unknown): void => {
            Reflect.deleteProperty(window, name);
            tag.remove();
            done(v);
          };
          (window as unknown as Record<string, unknown>)[name] = end;
          tag.src = `${url}&callback=${name}`;
          tag.onerror = () => {
            end(null);
          };
          document.head.append(tag);
        });
    if (Array.isArray(data) && Array.isArray(data[1]))
      list = (data[1] as unknown[]).filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
  suggested.set(q, list);
  return list;
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

/**
 * A service's own page in a small window of its own, phone-shaped: the way in that always works,
 * since nothing is framed (sites that refuse a frame, or a sign-in that needs its own page).
 */
export function openWindow(url: string): void {
  if (inExtension) {
    void chrome.windows.create({ url, type: "popup", width: 460, height: 820 });
    return;
  }
  window.open(url, "_blank", "popup,width=460,height=820");
}
