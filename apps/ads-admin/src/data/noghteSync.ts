import type { PromoCard, PromoWrite } from "./noghtePromo";

/**
 * Keeps Noghte's sponsor cards in step with NX Ads. The panel signs in to Noghte's server the way
 * its own admin panel does (a code by SMS to an admin's phone) and writes the cards through the
 * admin routes, reached via the panel's server at `/noghte` (vite.config.ts; Noghte's server sends
 * no CORS headers). Cards NX Ads made are named `nx-…`; one no longer published is switched off,
 * never deleted, and the others' order is kept after NX Ads' own.
 */

const BASE = "/noghte";
const KEY = "nx-ads.noghte.v1";

type Tokens = { accessToken: string; refreshToken: string; phone: string };

/** A card as Noghte's panel lists it. */
export type PromoRow = {
  id: string;
  /** The app's place for cards; only "calendar" so far. */
  slot: string;
  rank: number;
  on: boolean;
  card: PromoCard;
};

export class NoghteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function load(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : (JSON.parse(raw) as Tokens);
  } catch {
    return null;
  }
}

let tokens: Tokens | null = load();
const listeners = new Set<() => void>();

function save(t: Tokens | null): void {
  tokens = t;
  try {
    if (t === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // a private window: signed in for this tab only
  }
  for (const l of [...listeners]) l();
}

export const noghteAccount = (): string | null => tokens?.phone ?? null;
export function onNoghteAccount(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

async function errorOf(res: Response): Promise<NoghteError> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return new NoghteError(res.status, typeof body.error === "string" ? body.error : "failed");
}

async function post(path: string, body: object): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function requestCode(phone: string): Promise<void> {
  const res = await post("/auth/code/request", { kind: "phone", target: phone });
  if (!res.ok) throw await errorOf(res);
}

export async function verifyCode(phone: string, code: string): Promise<void> {
  const res = await post("/auth/code/verify", {
    kind: "phone",
    target: phone,
    code,
    device: "NX Ads",
  });
  if (!res.ok) throw await errorOf(res);
  const out = (await res.json()) as { accessToken: string; refreshToken: string };
  save({ accessToken: out.accessToken, refreshToken: out.refreshToken, phone });
  // only an admin's phone may write cards; ask now so a wrong number is told at once
  try {
    await call("GET", "/admin/api/me");
  } catch (e) {
    save(null);
    throw e;
  }
}

export function signOut(): void {
  save(null);
}

async function renew(): Promise<boolean> {
  if (tokens === null) return false;
  const res = await post("/auth/refresh", { refreshToken: tokens.refreshToken });
  if (!res.ok) {
    save(null);
    return false;
  }
  const { accessToken } = (await res.json()) as { accessToken: string };
  save({ ...tokens, accessToken });
  return true;
}

async function call<T>(method: string, path: string, body?: object): Promise<T> {
  const send = (): Promise<Response> =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(tokens === null ? {} : { authorization: `Bearer ${tokens.accessToken}` }),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let res = await send();
  if (res.status === 401 && (await renew())) res = await send();
  if (!res.ok) throw await errorOf(res);
  return (await res.json()) as T;
}

export type SyncPlan = {
  /** Each card to write, in order: NX Ads' live cards on, its old ones off. */
  puts: { id: string; body: { slot: string; on: boolean; card: PromoCard } }[];
  /** The place's order: NX Ads' live cards by share, then everyone else's as they were. */
  order: string[];
};

export const isOurs = (id: string): boolean => id.startsWith("nx-");

/** What to write so Noghte's list matches what NX Ads publishes; pure, for the tests. */
export function planPromoSync(writes: readonly PromoWrite[], rows: readonly PromoRow[]): SyncPlan {
  const live = new Set(writes.map((w) => w.id));
  const stale = rows.filter((r) => isOurs(r.id) && !live.has(r.id) && r.on);
  const others = rows
    .filter((r) => r.slot === "calendar" && !live.has(r.id) && !isOurs(r.id))
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.id);
  const oldOurs = rows.filter((r) => isOurs(r.id) && !live.has(r.id)).map((r) => r.id);
  return {
    puts: [
      ...writes.map((w) => ({ id: w.id, body: { slot: w.slot, on: true, card: w.card } })),
      ...stale.map((r) => ({ id: r.id, body: { slot: r.slot, on: false, card: r.card } })),
    ],
    order: [...writes.map((w) => w.id), ...others, ...oldOurs],
  };
}

/** Writes NX Ads' cards to Noghte's server; returns how many were written and switched off. */
export async function syncPromos(
  writes: readonly PromoWrite[],
): Promise<{ on: number; off: number }> {
  const { promos } = await call<{ promos: PromoRow[] }>("GET", "/admin/api/promos");
  const plan = planPromoSync(writes, promos);
  for (const p of plan.puts) await call("PUT", `/admin/api/promos/${p.id}`, p.body);
  await call("PUT", "/admin/api/promos-order", { slot: "calendar", ids: plan.order });
  return { on: writes.length, off: plan.puts.length - writes.length };
}
