import { load, remove, save } from "../platform";

/**
 * نقطه's server: signing in with a code (the same `/auth/code/*` the phone uses) and authorised
 * calls for sync. In production the server is behind noghte.life under `/api`; a build made with
 * `VITE_API_URL` talks to another one (the local server on :3100 during development).
 */

const FROM_ENV = import.meta.env.VITE_API_URL as string | undefined;
export const API_BASE = (
  FROM_ENV !== undefined && FROM_ENV !== "" ? FROM_ENV : "https://noghte.life/api"
).replace(/\/+$/, "");

/** How this browser appears in «دستگاه‌ها» on the phone. */
const DEVICE = "Chrome · میز";

export type Session = {
  accountId: string;
  /** The phone number or email the person signed in with, for «حساب». */
  label: string;
  accessToken: string;
  refreshToken: string;
  /** When the access token runs out (ms since epoch). */
  expiresAt: number;
};

const SESSION_KEY = "noghte.session.v1";

/** Why a call failed: the server's own reason (`code_invalid`, `too_soon`…) or `offline`. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly data: Readonly<Record<string, unknown>> = {},
  ) {
    super(code);
  }
}

async function call<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.token !== undefined ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
  } catch {
    throw new ApiError("offline", 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof data.error === "string" ? data.error : "server_error";
    throw new ApiError(code, res.status, data);
  }
  return data as T;
}

// ---- the session, kept in the extension's own storage ----

let session: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

export async function loadSession(): Promise<Session | null> {
  if (!loaded) {
    session = (await load<Session>(SESSION_KEY)) ?? null;
    loaded = true;
  }
  return session;
}

export const currentSession = (): Session | null => session;

export function onSession(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function setSession(s: Session | null): Promise<void> {
  session = s;
  loaded = true;
  if (s === null) await remove(SESSION_KEY);
  else await save(SESSION_KEY, s);
  for (const l of listeners) l();
}

// ---- signing in ----

type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
type SignedIn = Tokens & { account: { id: string } };

/** Asks for a code by SMS. Resolves with how long until another may be asked for (seconds). */
export async function requestCode(phone: string): Promise<{ retryAfter: number }> {
  return call("/auth/code/request", { body: { kind: "phone", target: phone } });
}

export async function verifyCode(phone: string, code: string): Promise<Session> {
  const r = await call<SignedIn>("/auth/code/verify", {
    body: { kind: "phone", target: phone, code, device: DEVICE },
  });
  const s: Session = {
    accountId: r.account.id,
    label: phone,
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiresAt: Date.now() + r.expiresIn * 1000,
  };
  await setSession(s);
  return s;
}

export async function signOut(): Promise<void> {
  const s = session;
  if (s !== null) {
    // gone from the server at once, not an hour later; signed out here even when offline
    await call("/auth/logout", { method: "POST", body: {}, token: s.accessToken }).catch(() => {});
  }
  await setSession(null);
}

// ---- authorised calls ----

let refreshing: Promise<string | null> | null = null;

/** A fresh access token, refreshing it once when it has run out (a minute early). */
async function accessToken(force = false): Promise<string | null> {
  const s = session;
  if (s === null) return null;
  if (!force && s.expiresAt - 60_000 > Date.now()) return s.accessToken;
  refreshing ??= (async () => {
    try {
      const r = await call<{ accessToken: string; expiresIn: number }>("/auth/refresh", {
        body: { refreshToken: s.refreshToken },
      });
      await setSession({
        ...s,
        accessToken: r.accessToken,
        expiresAt: Date.now() + r.expiresIn * 1000,
      });
      return r.accessToken;
    } catch (e) {
      // the session was revoked (signed out on the phone, or expired after 180 days unused)
      if (e instanceof ApiError && e.status === 401) await setSession(null);
      throw e;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function authed<T>(path: string, opts: { body?: unknown } = {}): Promise<T> {
  const token = await accessToken();
  if (token === null) throw new ApiError("signed_out", 401);
  try {
    return await call<T>(path, { ...opts, token });
  } catch (e) {
    // an access token the server no longer takes (its clock ran ahead of ours): refresh once
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    const again = await accessToken(true);
    if (again === null) throw e;
    return call<T>(path, { ...opts, token: again });
  }
}
