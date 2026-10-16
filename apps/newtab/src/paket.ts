import { useEffect, useState } from "react";

import { installId } from "./install";
import { load, remove, save } from "./platform";

/**
 * پاکت (the person's money app) for the money slide. Paket has its own accounts, so the two meet the
 * way Paket designed for this extension (PFM/paket docs/knowledge/chrome-extension-link.md): the
 * phone shows a one-time code under «تنظیمات ← دستگاه‌ها و افزونه», the person types it here, and
 * the extension gets a read-only session that can only read one summary —
 * `GET /v1/extension/snapshot` — plus Paket's public news. Nothing is ever written to Paket.
 */

const FROM_ENV = import.meta.env.VITE_PAKET_API_URL as string | undefined;
export const PAKET_API = (
  FROM_ENV !== undefined && FROM_ENV !== "" ? FROM_ENV : "https://api.paket.app"
).replace(/\/+$/, "");

const KEY = "paket.v1";
type Stored = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  installationId: string;
};

export type Snapshot = {
  generatedAt: string;
  balance: { amountMinor: string; currencyCode: string };
  budget: {
    name: string;
    limitMinor: string | null;
    spentMinor: string;
    currencyCode: string;
    periodStart: string;
  } | null;
  transactions: {
    id: string;
    direction: "debit" | "credit";
    amountMinor: string;
    currencyCode: string;
    title: string;
    occurredAt: string;
  }[];
  upcoming: {
    id: string;
    title: string;
    dueDate: string;
    amountMinor: string | null;
    currencyCode: string | null;
  }[];
  obligations: {
    owedByMe: { amountMinor: string; currencyCode: string };
    owedToMe: { amountMinor: string; currencyCode: string };
    items: {
      id: string;
      kind: "debt" | "claim";
      title: string;
      counterpartyName: string | null;
      amountMinor: string;
      currencyCode: string;
      nextDueDate: string | null;
    }[];
  };
};

export type NewsItem = {
  id: string;
  kind: "ipo" | "opportunity" | "announcement" | "offer";
  title: string;
  summary: string;
  thumbnailUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  publishedAt: string;
};

export class PaketError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

let stored: Stored | null = null;
const current = (): Stored | null => stored;
let linked = false;
const listeners = new Set<() => void>();
const changed = (): void => {
  for (const l of listeners) l();
};

export async function loadPaket(): Promise<void> {
  stored = (await load<Stored>(KEY)) ?? null;
  linked = stored !== null;
  changed();
}

export function usePaketLinked(): boolean {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = (): void => {
      setTick((t) => t + 1);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return linked;
}

type Tokens = { accessToken: string; refreshToken: string; expiresInSeconds: number };
type Answer<B> = { status: number; body: B };

async function call(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  let res: Response;
  try {
    res = await fetch(`${PAKET_API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch {
    throw new PaketError("offline");
  }
  const body: unknown = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/** Trades the code from the phone for a read-only session. */
export async function linkPaket(code: string): Promise<void> {
  const installationId = `noghte-${await installId()}`;
  const r = (await call("/v1/extension/pair/redeem", {
    method: "POST",
    body: JSON.stringify({ code: code.trim(), installationId, appVersion: "0.1.0" }),
  })) as Answer<{ tokens?: Tokens; code?: string }>;
  if (r.status !== 200 || r.body.tokens === undefined)
    throw new PaketError(r.body.code ?? `http_${String(r.status)}`);
  const t = r.body.tokens;
  stored = {
    accessToken: t.accessToken,
    refreshToken: t.refreshToken,
    expiresAt: Date.now() + (t.expiresInSeconds - 30) * 1000,
    installationId,
  };
  await save(KEY, stored);
  linked = true;
  changed();
}

/** Forgets the link here. (The session is read-only and cannot sign itself out; the phone's «قطع اتصال» ends it there.) */
export async function unlinkPaket(): Promise<void> {
  stored = null;
  linked = false;
  await remove(KEY);
  changed();
}

async function refresh(): Promise<boolean> {
  if (stored === null) return false;
  const r = (await call("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({
      refreshToken: stored.refreshToken,
      installationId: stored.installationId,
    }),
  })) as Answer<{ tokens?: Tokens }>;
  if (r.status !== 200 || r.body.tokens === undefined) {
    // the phone unlinked this extension, or the link was made again elsewhere
    if (r.status === 401) await unlinkPaket();
    return false;
  }
  const t = r.body.tokens;
  stored = {
    ...stored,
    accessToken: t.accessToken,
    refreshToken: t.refreshToken,
    expiresAt: Date.now() + (t.expiresInSeconds - 30) * 1000,
  };
  await save(KEY, stored);
  return true;
}

export async function snapshot(): Promise<Snapshot> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (stored === null) throw new PaketError("not_linked");
    if (stored.expiresAt <= Date.now() && !(await refresh())) throw new PaketError("not_linked");
    // a refresh refused by Paket forgets the link
    const now = current();
    if (now === null) throw new PaketError("not_linked");
    const r = (await call("/v1/extension/snapshot", {
      headers: { Authorization: `Bearer ${now.accessToken}` },
    })) as Answer<Snapshot & { code?: string }>;
    if (r.status === 200) return r.body;
    if (r.status === 401 && attempt === 0) {
      stored = { ...now, expiresAt: 0 };
      continue;
    }
    throw new PaketError(r.body.code ?? `http_${String(r.status)}`);
  }
  throw new PaketError("not_linked");
}

/** Paket's public news, the same as on the app's home page (no sign-in needed). */
export async function paketNews(): Promise<NewsItem[]> {
  const r = (await call("/v1/news")) as Answer<{ items?: NewsItem[] }>;
  return r.status === 200 ? (r.body.items ?? []) : [];
}

/** The summary, asked again every minute while the tab is in view and when it comes back. */
export function useSnapshot(): { data: Snapshot | null; error: string | null } {
  const on = usePaketLinked();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!on) {
      setData(null);
      return;
    }
    let live = true;
    const pull = (): void => {
      if (document.visibilityState !== "visible") return;
      void snapshot().then(
        (s) => {
          if (live) {
            setData(s);
            setError(null);
          }
        },
        (e: unknown) => {
          if (live) setError(e instanceof PaketError ? e.code : "error");
        },
      );
    };
    pull();
    const t = setInterval(pull, 60_000);
    document.addEventListener("visibilitychange", pull);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", pull);
    };
  }, [on]);
  return { data, error };
}

export function usePaketNews(): NewsItem[] {
  const [items, setItems] = useState<NewsItem[]>([]);
  useEffect(() => {
    void paketNews().then(setItems, () => undefined);
  }, []);
  return items;
}

// ---- toman, as Paket stores and shows it ----

/** «۸٬۴۲۰٬۰۰۰» from a digit string (a 64-bit amount never goes through a float). */
export function toman(minor: string): string {
  const neg = minor.startsWith("-");
  const digits = neg ? minor.slice(1) : minor;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return (neg ? "−" : "") + grouped.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)] ?? d);
}

/** «۱۸۴٫۶ م» for big totals. */
export function shortToman(minor: string): { value: string; unit: string } {
  const n = Number(minor);
  const abs = Math.abs(n);
  const fa = (x: string): string =>
    x.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)] ?? d).replace(".", "٫");
  if (abs >= 1e9) return { value: fa((n / 1e9).toFixed(1)), unit: "میلیارد" };
  if (abs >= 1e6) return { value: fa((n / 1e6).toFixed(1)), unit: "م" };
  return { value: toman(minor), unit: "تومان" };
}
