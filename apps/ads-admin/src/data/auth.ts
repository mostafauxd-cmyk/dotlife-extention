/**
 * Who may use NX Ads: an admin of Noghte, signed in the way Noghte's own panel signs in (a code by
 * SMS to the phone, `/auth/code/*`), and checked against `/admin/api/me` — a phone that is not an
 * admin is signed out at once. The panel is meant to be served beside Noghte's server, so its API
 * is the same origin (`/api`); in development it goes through the dev server's `/noghte` proxy.
 *
 * Kept as little as possible, as briefly as possible:
 * - the access token lives only in memory;
 * - the refresh token lives in `sessionStorage` (this tab only, gone when it closes), so a reload
 *   does not sign out but another tab, or the browser later, starts signed out;
 * - 30 minutes without a click or a key signs out, and signing out also ends the session on the
 *   server (`/auth/logout`).
 */

const FROM_ENV: unknown = import.meta.env.VITE_NOGHTE_API;
export const API_BASE =
  typeof FROM_ENV === "string" && FROM_ENV !== ""
    ? FROM_ENV
    : import.meta.env.DEV
      ? "/noghte"
      : "/api";

/** Development only, and only when asked for: the panel opens without signing in. */
export const AUTH_REQUIRED = !(
  import.meta.env.DEV && (import.meta.env.VITE_NX_ADS_NO_AUTH as unknown) === "1"
);

const KEY = "nx-ads.session.v1";
export const IDLE_MS = 30 * 60_000;

type Stored = { refreshToken: string; phone: string };
type Session = { accessToken: string; refreshToken: string; phone: string };

export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

let session: Session | null = null;
let restoring = true;
const listeners = new Set<() => void>();
let snapshot: { phone: string | null; restoring: boolean } = { phone: null, restoring: true };

function emit(): void {
  snapshot = { phone: session?.phone ?? null, restoring };
  for (const l of [...listeners]) l();
}

function store(s: Session | null): void {
  session = s;
  try {
    if (s === null) sessionStorage.removeItem(KEY);
    else
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ refreshToken: s.refreshToken, phone: s.phone } satisfies Stored),
      );
  } catch {
    // storage refused: signed in until the page is left
  }
  emit();
}

/** Who is signed in and whether a reload's session is still being restored. */
export const authState = (): { phone: string | null; restoring: boolean } => snapshot;
export function onAuth(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

async function errorOf(res: Response): Promise<AuthError> {
  const body = (await res.json().catch(() => ({}))) as { error?: unknown };
  return new AuthError(res.status, typeof body.error === "string" ? body.error : "failed");
}

const post = (path: string, body: object, token?: string): Promise<Response> =>
  fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "content-type": "application/json",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

/** A phone number as Iranian mobiles are written: 09 and nine digits (Persian digits allowed). */
export function cleanPhone(raw: string): string | null {
  const latin = raw.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[\s-]/g, "");
  const local = latin.startsWith("+98") ? `0${latin.slice(3)}` : latin;
  return /^09\d{9}$/.test(local) ? local : null;
}

export async function requestCode(phone: string): Promise<void> {
  const res = await post("/auth/code/request", { kind: "phone", target: phone });
  if (!res.ok) throw await errorOf(res);
}

export async function verifyCode(phone: string, code: string): Promise<void> {
  const res = await post("/auth/code/verify", {
    kind: "phone",
    target: phone,
    code: code.trim(),
    device: "NX Ads",
  });
  if (!res.ok) throw await errorOf(res);
  const out = (await res.json()) as { accessToken: string; refreshToken: string };
  store({ accessToken: out.accessToken, refreshToken: out.refreshToken, phone });
  // only an admin's phone may stay; any other is signed out (and its session ended) at once
  try {
    await call("GET", "/admin/api/me");
  } catch (e) {
    await signOut();
    throw e;
  }
}

export async function signOut(): Promise<void> {
  const s = session;
  store(null);
  if (s !== null) await post("/auth/logout", {}, s.accessToken).catch(() => undefined);
}

async function renew(refreshToken: string, phone: string): Promise<boolean> {
  const res = await post("/auth/refresh", { refreshToken }).catch(() => null);
  if (res === null || !res.ok) {
    store(null);
    return false;
  }
  const { accessToken, refreshToken: next } = (await res.json()) as {
    accessToken: string;
    refreshToken?: string;
  };
  store({ accessToken, refreshToken: next ?? refreshToken, phone });
  return true;
}

/** After a reload: the tab's refresh token, if any, buys a new access token. */
export async function restore(): Promise<void> {
  const saved = readStored();
  if (saved !== null) await renew(saved.refreshToken, saved.phone);
  restoring = false;
  emit();
}

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw === null ? null : (JSON.parse(raw) as Stored);
  } catch {
    return null;
  }
}

/** A call to Noghte's admin API as the signed-in admin; an expired token is renewed once. */
export async function call<T>(method: string, path: string, body?: object): Promise<T> {
  const send = (): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      method,
      credentials: "omit",
      headers: {
        ...(session === null ? {} : { authorization: `Bearer ${session.accessToken}` }),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let res = await send();
  if (res.status === 401 && session !== null && (await renew(session.refreshToken, session.phone)))
    res = await send();
  if (!res.ok) throw await errorOf(res);
  return (await res.json()) as T;
}

/** Signs out after `IDLE_MS` without a click, a key or a touch. Returns the way to stop. */
export function watchIdle(now: () => number = Date.now): () => void {
  let last = now();
  const touch = (): void => {
    last = now();
  };
  const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
  for (const e of events) window.addEventListener(e, touch, { passive: true });
  const timer = window.setInterval(() => {
    if (session !== null && now() - last > IDLE_MS) void signOut();
  }, 30_000);
  return () => {
    for (const e of events) window.removeEventListener(e, touch);
    window.clearInterval(timer);
  };
}
