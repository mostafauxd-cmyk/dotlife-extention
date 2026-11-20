import { useEffect, useState } from "react";

import { API_BASE } from "./noghte/api";
import { records } from "./noghte/records";
import { inExtension, load, remove, save } from "./platform";

/**
 * Keeping the extension new (2026-11-20, the user: «یا خودکار اپدیت بشه افزونه شون یا با یک دایالوگ
 * متوجه بشن چطوری اپدیتش کنن»).
 *
 * - From the store: Chrome is asked for an update now and then (it looks only every few hours by
 *   itself), and the service worker installs one at once when no page of ours is open
 *   (`public/background.js`). With a page open, `ready` holds the version and the page offers it.
 * - Afterwards `done` says which version came, once.
 * - An install that cannot update by itself (loaded from a folder or a zip), or a store install
 *   whose browser cannot reach Google: نقطه's own `/config` may name the newest version
 *   (`extension.latestVersion`); when this one is older, `behind` asks the page to say how.
 */

const READY = "update.ready";
const DONE = "update.done";
const CHECKED = "update.checkedAt";
const SNOOZED = "update.snoozed";
/** Chrome refuses checks asked too often; every three hours is well inside what it allows. */
const CHECK_EVERY_MS = 3 * 3600_000;
const SNOOZE_MS = 24 * 3600_000;

export type Install = "store" | "manual" | "unknown";
export type UpdateState = {
  install: Install;
  /** A store update downloaded and waiting for this page to let it in. */
  ready: string | null;
  /** Just updated: from which version to which (shown once). */
  done: { from: string | null; to: string } | null;
  /** A newer version نقطه knows of, that this browser does not have yet. */
  behind: { latest: string; downloadUrl: string | null } | null;
};

/** -1, 0 or 1 for «0.1.3» against «0.1.10». */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

const VERSION = /^\d+(\.\d+){0,3}$/;

/** The `extension` part of نقطه's `/config`, only what fits; anything else → null. */
export function parseExtensionInfo(
  json: unknown,
): { latestVersion: string; downloadUrl: string | null } | null {
  if (typeof json !== "object" || json === null) return null;
  const e = (json as { extension?: unknown }).extension;
  if (typeof e !== "object" || e === null) return null;
  const { latestVersion, downloadUrl } = e as Record<string, unknown>;
  if (typeof latestVersion !== "string" || !VERSION.test(latestVersion)) return null;
  const url =
    typeof downloadUrl === "string" && /^https:\/\//i.test(downloadUrl) ? downloadUrl : null;
  return { latestVersion, downloadUrl: url };
}

const currentVersion = (): string => (inExtension ? chrome.runtime.getManifest().version : "0.0.0");

async function installOf(): Promise<Install> {
  if (!inExtension) return "unknown";
  try {
    const self = await chrome.management.getSelf();
    if (self.installType === "normal") return "store";
    if (self.installType === "development" || self.installType === "sideload") return "manual";
  } catch {
    // an older Chrome without management.getSelf for extensions: say nothing about it
  }
  return "unknown";
}

/** Asks Chrome for a store update, no more often than every few hours. */
async function askChrome(install: Install): Promise<void> {
  if (install !== "store") return;
  const last = (await load<number>(CHECKED)) ?? 0;
  if (Date.now() - last < CHECK_EVERY_MS) return;
  await save(CHECKED, Date.now());
  try {
    const r = await chrome.runtime.requestUpdateCheck();
    // the service worker hears it too; this page needs no wait for that
    if (r.status === "update_available" && r.version !== undefined) await save(READY, r.version);
  } catch {
    // Google out of reach (a filtered network): نقطه's own word below still tells
  }
}

/** The newest version according to نقطه's server, or null when it does not say. */
async function askNoghte(): Promise<{ latestVersion: string; downloadUrl: string | null } | null> {
  try {
    const r = await fetch(`${API_BASE}/config`, { cache: "no-cache" });
    return r.ok ? parseExtensionInfo(await r.json()) : null;
  } catch {
    return null;
  }
}

/** The dev page's way to look at each state: `?update=ready|done|store|manual`. */
function devState(): UpdateState | null {
  if (!import.meta.env.DEV) return null;
  const k = new URLSearchParams(location.search).get("update");
  const none: UpdateState = { install: "store", ready: null, done: null, behind: null };
  if (k === "ready") return { ...none, ready: "0.2.0" };
  if (k === "done") return { ...none, done: { from: "0.1.3", to: "0.2.0" } };
  if (k === "store") return { ...none, behind: { latest: "0.2.0", downloadUrl: null } };
  if (k === "manual")
    return {
      ...none,
      install: "manual",
      behind: { latest: "0.2.0", downloadUrl: "https://noghte.life/" },
    };
  return null;
}

export function useUpdate(): UpdateState {
  const [state, setState] = useState<UpdateState>(
    () => devState() ?? { install: "unknown", ready: null, done: null, behind: null },
  );
  useEffect(() => {
    if (!inExtension || devState() !== null) return;
    let live = true;
    const read = async (install: Install, latest: Awaited<ReturnType<typeof askNoghte>>) => {
      const ready = (await load<string>(READY)) ?? null;
      const done = (await load<UpdateState["done"]>(DONE)) ?? null;
      const snoozed = await load<{ version: string; until: number }>(SNOOZED);
      const mine = currentVersion();
      const newer =
        latest !== null && compareVersions(latest.latestVersion, mine) > 0 ? latest : null;
      const quiet =
        newer !== null && snoozed?.version === newer.latestVersion && snoozed.until > Date.now();
      // a version waiting to go in that is not newer than this one is a leftover
      const waiting = ready !== null && compareVersions(ready, mine) > 0 ? ready : null;
      if (!live) return;
      setState({
        install,
        ready: waiting,
        done,
        behind:
          newer === null || quiet || waiting !== null
            ? null
            : { latest: newer.latestVersion, downloadUrl: newer.downloadUrl },
      });
    };
    let install: Install = "unknown";
    let latest: Awaited<ReturnType<typeof askNoghte>> = null;
    void (async () => {
      install = await installOf();
      await read(install, null);
      await askChrome(install);
      latest = await askNoghte();
      await read(install, latest);
    })();
    const onChange = (changes: Record<string, unknown>, area: string): void => {
      if (area === "local" && (READY in changes || DONE in changes || SNOOZED in changes))
        void read(install, latest);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      live = false;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);
  return state;
}

/** Lets the waiting update in: what is written here is saved first, then the extension reloads. */
export async function applyUpdate(): Promise<void> {
  if (!inExtension) return;
  await records.persist();
  chrome.runtime.reload();
}

/** Asks Chrome again now (the dialog's «بررسی دوباره»): true when an update was found. */
export async function checkNow(): Promise<"found" | "none" | "failed"> {
  if (!inExtension) return "failed";
  try {
    const r = await chrome.runtime.requestUpdateCheck();
    if (r.status === "update_available") {
      if (r.version !== undefined) await save(READY, r.version);
      return "found";
    }
    return r.status === "no_update" ? "none" : "failed";
  } catch {
    return "failed";
  }
}

/** Chrome's page of this extension, where «به‌روزرسانی» and reload are. */
export function openExtensionsPage(): void {
  if (!inExtension) return;
  void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
}

export const seenDone = (): Promise<void> => remove(DONE);

/** «بعداً»: the same version is not offered again for a day. */
export const snooze = (version: string): Promise<void> =>
  save(SNOOZED, { version, until: Date.now() + SNOOZE_MS });
