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
const CACHE = "paket.snapshot.v1";
type Stored = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  installationId: string;
};

export type Money = { amountMinor: string; currencyCode: string };

/** `GET /v1/extension/snapshot`: everything on the money slide except the market's prices. Amounts are digit strings in minor units (toman). */
export type Snapshot = {
  generatedAt: string;
  /** The Jalali month the figures are for. `day` is today, counted from 1. */
  month: {
    year: number;
    month: number;
    monthName: string;
    start: string;
    end: string;
    daysInMonth: number;
    day: number;
  };
  balance: {
    amountMinor: string;
    currencyCode: string;
    changePercent: number | null;
    accountCount: number;
  };
  accounts: {
    id: string;
    name: string;
    bankId: string | null;
    color: string | null;
    isCash: boolean;
    maskedIdentifier: string | null;
    balanceMinor: string;
    includeInTotal: boolean;
  }[];
  monthTotals: { incomeMinor: string; expenseMinor: string; currencyCode: string };
  /** Spending day by day from the 1st to today, and where Paket thinks the month will end. */
  spend: { dailyMinor: string[]; forecastMinor: string | null; forecastMethod: string };
  budget: {
    name: string;
    limitMinor: string | null;
    spentMinor: string;
    remainingPerDayMinor: string | null;
    currencyCode: string;
    periodStart: string;
  } | null;
  categories: {
    id: string;
    name: string;
    color: string | null;
    spentMinor: string;
    limitMinor: string | null;
  }[];
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
    categoryName: string | null;
    categoryColor: string | null;
  }[];
  obligations: {
    owedByMe: Money;
    owedToMe: Money;
    openCount: number;
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
  /** Bank text messages waiting for the person's yes in Paket. */
  pendingApprovals: { count: number };
  news: { items: NewsItem[]; version: string };
};

export type NewsItem = {
  id: string;
  kind: "ipo" | "opportunity" | "announcement" | "offer";
  title: string;
  summary: string;
  body?: string;
  thumbnailUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  publishedAt: string;
  pinned?: boolean;
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

/**
 * Ends the link: Paket is told first (so the phone's list of devices drops this one), then it is
 * forgotten here, whether or not Paket answered.
 */
export async function unlinkPaket(): Promise<void> {
  const was = stored;
  stored = null;
  linked = false;
  await Promise.all([remove(KEY), remove(CACHE)]);
  changed();
  if (was === null) return;
  try {
    await call("/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${was.accessToken}` },
    });
  } catch {
    // offline or already revoked: nothing more to do
  }
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

/** Fills what an older server leaves out, so a missing field never breaks the slide. */
export function withDefaults(raw: Partial<Snapshot> & { generatedAt: string }): Snapshot {
  const zero = (c: string): Money => ({ amountMinor: "0", currencyCode: c });
  const cur = raw.balance?.currencyCode ?? "IRT";
  const today = new Date(raw.generatedAt);
  return {
    month: {
      year: 0,
      month: 0,
      monthName: "",
      start: "",
      end: "",
      daysInMonth: 30,
      day: Math.min(30, Math.max(1, today.getUTCDate())),
    },
    balance: { amountMinor: "0", currencyCode: cur, changePercent: null, accountCount: 0 },
    accounts: [],
    monthTotals: { incomeMinor: "0", expenseMinor: "0", currencyCode: cur },
    spend: { dailyMinor: [], forecastMinor: null, forecastMethod: "pace" },
    budget: null,
    categories: [],
    transactions: [],
    upcoming: [],
    pendingApprovals: { count: 0 },
    news: { items: [], version: "" },
    ...raw,
    obligations: {
      owedByMe: zero(cur),
      owedToMe: zero(cur),
      openCount: 0,
      items: [],
      ...raw.obligations,
    },
  };
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
    })) as Answer<Partial<Snapshot> & { generatedAt: string; code?: string }>;
    if (r.status === 200) {
      const s = withDefaults(r.body);
      // only the latest summary is kept, for the next tab to show while the new one is on its way
      void save(CACHE, s).catch(() => undefined);
      return s;
    }
    if (r.status === 401 && r.body.code === "DEVICE_REVOKED") {
      await unlinkPaket();
      throw new PaketError("not_linked");
    }
    if (r.status === 401 && attempt === 0) {
      stored = { ...now, expiresAt: 0 };
      continue;
    }
    throw new PaketError(r.body.code ?? `http_${String(r.status)}`);
  }
  throw new PaketError("not_linked");
}

/** A public, token-less read (the news, the market's prices). */
export async function paketGet<T>(path: string): Promise<T | null> {
  const r = await call(path);
  return r.status === 200 ? (r.body as T) : null;
}

/** Paket's public news, the same as on the app's home page (no sign-in needed). */
export async function paketNews(): Promise<NewsItem[]> {
  const r = (await call("/v1/news")) as Answer<{ items?: NewsItem[] }>;
  return r.status === 200 ? (r.body.items ?? []) : [];
}

/**
 * The summary, asked again every minute while the tab is in view and when it comes back. The last one
 * received is shown at once (and kept when Paket cannot be reached), with `error` saying why it is old.
 */
export function useSnapshot(active = true): { data: Snapshot | null; error: string | null } {
  const on = usePaketLinked();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!on) {
      setData(null);
      setError(null);
      return;
    }
    let live = true;
    void load<Snapshot>(CACHE).then((c) => {
      if (live && c !== undefined) setData((d) => d ?? withDefaults(c));
    });
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
    if (!active) {
      return () => {
        live = false;
      };
    }
    pull();
    const t = setInterval(pull, 60_000);
    document.addEventListener("visibilitychange", pull);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", pull);
    };
  }, [on, active]);
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

// ---- the code from the phone ----

/** The letters a code is made of (no 0 O 1 I L 2 Z 5 S 8 B, so none can be misread). */
const CODE_LETTERS = "ACDEFGHJKMNPQRTUVWXY3467";

/**
 * What is typed or pasted → «K7QM-4XDA»: capitals, only the code's letters, eight at most, a dash
 * after four. A whole `paket://pair?c=…` link pasted from the phone gives its code.
 */
export function formatCode(raw: string): string {
  const fromLink = /[?&]c=([^&\s]+)/.exec(raw);
  const letters = (fromLink?.[1] ?? raw)
    .toUpperCase()
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .split("")
    .filter((c) => CODE_LETTERS.includes(c))
    .slice(0, 8)
    .join("");
  return letters.length > 4 ? `${letters.slice(0, 4)}-${letters.slice(4)}` : letters;
}
