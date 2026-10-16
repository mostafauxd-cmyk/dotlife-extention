import type { Change, PullResponse, PushResponse } from "@dotlife/sync";

import { syncOnce, type Remote } from "../sync/engine";
import { ApiError, authed, currentSession, loadSession, onSession } from "./api";
import { records } from "./records";

/**
 * Keeping this tab and the account in step: a sync when the tab opens or comes back into view,
 * every 15 seconds while it is in view, and a moment after anything is changed here. Nothing runs
 * while the tab is hidden. What arrives from another device is announced, so its corner can open.
 */

const EVERY_MS = 15_000;
const AFTER_EDIT_MS = 1_500;

export type SyncState = {
  status: "signed-out" | "idle" | "syncing" | "offline" | "error";
  /** When the last sync finished well (ms since epoch). */
  lastAt: number | null;
};

const remote: Remote = {
  push: (changes) => authed<PushResponse>("/sync/push", { body: { changes } }),
  pull: (since) => authed<PullResponse>(`/sync/pull?since=${String(since)}`),
};

let state: SyncState = { status: "signed-out", lastAt: null };
const stateListeners = new Set<() => void>();
const arrivalListeners = new Set<(changes: readonly Change[]) => void>();

export const syncState = (): SyncState => state;

export function onSyncState(fn: () => void): () => void {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

/** Records that arrived from another device (not the first download after signing in). */
export function onArrival(fn: (changes: readonly Change[]) => void): () => void {
  arrivalListeners.add(fn);
  return () => arrivalListeners.delete(fn);
}

function setState(s: Partial<SyncState>): void {
  state = { ...state, ...s };
  for (const l of stateListeners) l();
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (currentSession() === null) return Promise.resolve();
  if (running !== null) {
    // an edit while a sync is on its way: one more right after it
    again = true;
    return running;
  }
  running = (async () => {
    setState({ status: "syncing" });
    try {
      const first = (await records.local.cursor()) === 0;
      await syncOnce(records.local, remote);
      await records.persist();
      setState({ status: "idle", lastAt: Date.now() });
      const arrived = records.takeArrived();
      if (!first && arrived.length > 0) for (const l of arrivalListeners) l(arrived);
    } catch (e) {
      const offline = e instanceof ApiError && e.code === "offline";
      setState({
        status: currentSession() === null ? "signed-out" : offline ? "offline" : "error",
      });
    } finally {
      running = null;
    }
    if (again) {
      again = false;
      await syncNow();
    }
  })();
  return running;
}

let timer: ReturnType<typeof setInterval> | null = null;
let editTimer: ReturnType<typeof setTimeout> | null = null;

const visible = (): boolean => document.visibilityState === "visible";

/** Starts keeping in step for the signed-in account (and again whenever the session changes). */
export async function startSync(): Promise<void> {
  const open = async (): Promise<void> => {
    const s = currentSession();
    if (s === null) {
      await records.clear();
      setState({ status: "signed-out", lastAt: null });
      return;
    }
    await records.open(s.accountId);
    setState({ status: "idle" });
    if (visible()) void syncNow();
  };
  await loadSession();
  onSession(() => void open());
  await open();

  timer ??= setInterval(() => {
    if (visible()) void syncNow();
  }, EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (visible()) void syncNow();
  });
  records.onChange(() => {
    if (records.pending() === 0) return;
    if (editTimer !== null) clearTimeout(editTimer);
    editTimer = setTimeout(() => void syncNow(), AFTER_EDIT_MS);
  });
}
