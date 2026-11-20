import { daysInMonth, fromJdn, monthName, toJdn } from "@dotlife/calendar-core";

import type { NewsItem, Snapshot } from "./paket";

/**
 * Made-up Paket data for looking at the money slide without a phone (2026-11-20, the user: «دیتای
 * سید بزار توی پاکت و تست کنیم ویوی خالی و کامل صفحه ش رو»). Only the dev page reads it, from the
 * address: `?paket=full` (a busy month), `?paket=empty` (an account just made). Nothing here is a
 * real person's money, and the store build never turns it on (`paket.ts`, `import.meta.env.DEV`).
 */

export type SeedKind = "full" | "empty";

export function seedKind(): SeedKind | null {
  if (!import.meta.env.DEV || typeof location === "undefined") return null;
  const k = new URLSearchParams(location.search).get("paket");
  return k === "full" || k === "empty" ? k : null;
}

const DAY_MS = 86_400_000;
const iso = (d: Date): string => d.toISOString().slice(0, 10);

/** Today's Jalali month, as Paket sends it. */
function monthOf(now: Date): Snapshot["month"] {
  const g = {
    calendar: "gregorian" as const,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
  const j = fromJdn(toJdn(g), "solar-hijri");
  const days = daysInMonth("solar-hijri", j.year, j.month);
  const start = new Date(now.getTime() - (j.day - 1) * DAY_MS);
  const end = new Date(start.getTime() + (days - 1) * DAY_MS);
  return {
    year: j.year,
    month: j.month,
    monthName: monthName(j),
    start: iso(start),
    end: iso(end),
    daysInMonth: days,
    day: j.day,
  };
}

const NEWS: NewsItem[] = [
  {
    id: "seed-n1",
    kind: "ipo",
    title: "عرضه‌ی اولیه‌ی «فولاد سپید» سه‌شنبه",
    summary: "سقف خرید هر کد ۲۰ میلیون تومان.",
    thumbnailUrl: null,
    ctaLabel: "جزئیات",
    ctaUrl: "https://paket.life/",
    publishedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
    pinned: true,
  },
  {
    id: "seed-n2",
    kind: "opportunity",
    title: "سود سپرده‌ی کوتاه‌مدت بانک‌ها به ۲۲٪ رسید",
    summary: "",
    thumbnailUrl: null,
    ctaLabel: null,
    ctaUrl: null,
    publishedAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
  },
  {
    id: "seed-n3",
    kind: "offer",
    title: "۱۵٪ تخفیف بیمه‌ی بدنه برای کاربران پاکت",
    summary: "",
    thumbnailUrl: null,
    ctaLabel: "دریافت کد",
    ctaUrl: "https://paket.life/",
    publishedAt: new Date(Date.now() - 50 * 3600_000).toISOString(),
  },
  {
    id: "seed-n4",
    kind: "announcement",
    title: "پاکت حالا پیامک بانک ملت را هم می‌خواند",
    summary: "",
    thumbnailUrl: null,
    ctaLabel: null,
    ctaUrl: null,
    publishedAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
  },
];

export function seedNews(kind: SeedKind): NewsItem[] {
  return kind === "full" ? NEWS : [];
}

export function seedSnapshot(kind: SeedKind, now = new Date()): Snapshot {
  const month = monthOf(now);
  const at = now.toISOString();
  const empty: Snapshot = {
    generatedAt: at,
    month,
    balance: { amountMinor: "0", currencyCode: "IRT", changePercent: null, accountCount: 1 },
    accounts: [
      {
        id: "seed-cash",
        name: "نقد",
        bankId: null,
        color: null,
        isCash: true,
        maskedIdentifier: null,
        balanceMinor: "0",
        includeInTotal: true,
      },
    ],
    monthTotals: { incomeMinor: "0", expenseMinor: "0", currencyCode: "IRT" },
    spend: {
      dailyMinor: Array.from({ length: month.day }, () => "0"),
      forecastMinor: null,
      forecastMethod: "pace",
    },
    budget: null,
    categories: [],
    transactions: [],
    upcoming: [],
    obligations: {
      owedByMe: { amountMinor: "0", currencyCode: "IRT" },
      owedToMe: { amountMinor: "0", currencyCode: "IRT" },
      openCount: 0,
      items: [],
    },
    pendingApprovals: { count: 0 },
    news: { items: [], version: "" },
  };
  if (kind === "empty") return empty;

  // a month of spending that adds up: a few big days (rent, a trip), the rest everyday
  const big: Record<number, number> = { 1: 18_000_000, 4: 2_400_000, 9: 6_800_000, 15: 3_100_000 };
  let total = 0;
  const dailyMinor = Array.from({ length: month.day }, (_v, i) => {
    const d = i + 1;
    const v = big[d] ?? 350_000 + ((d * 7919) % 9) * 110_000;
    total += v;
    return String(total);
  });
  const ago = (days: number, hour = 13): string =>
    new Date(now.getTime() - days * DAY_MS + (hour - now.getHours()) * 3600_000).toISOString();
  const ahead = (days: number): string => iso(new Date(now.getTime() + days * DAY_MS));

  return {
    ...empty,
    balance: {
      amountMinor: "184650000",
      currencyCode: "IRT",
      changePercent: -6.4,
      accountCount: 4,
    },
    accounts: [
      {
        id: "a1",
        name: "ملت",
        bankId: "mellat",
        color: "#D6334B",
        isCash: false,
        maskedIdentifier: "۶۱۰۴ ••• ۲۲۱۸",
        balanceMinor: "96400000",
        includeInTotal: true,
      },
      {
        id: "a2",
        name: "بلو",
        bankId: "blu",
        color: "#2F6BFF",
        isCash: false,
        maskedIdentifier: "۶۲۱۹ ••• ۹۰۴۱",
        balanceMinor: "61250000",
        includeInTotal: true,
      },
      {
        id: "a3",
        name: "رسالت",
        bankId: "resalat",
        color: "#1E9E6A",
        isCash: false,
        maskedIdentifier: "۵۰۴۱ ••• ۷۷۰۳",
        balanceMinor: "21000000",
        includeInTotal: true,
      },
      {
        id: "a4",
        name: "نقد",
        bankId: null,
        color: null,
        isCash: true,
        maskedIdentifier: null,
        balanceMinor: "6000000",
        includeInTotal: true,
      },
    ],
    monthTotals: { incomeMinor: "62000000", expenseMinor: String(total), currencyCode: "IRT" },
    spend: {
      dailyMinor,
      forecastMinor: String(Math.round((total / month.day) * month.daysInMonth * 0.86)),
      forecastMethod: "pace",
    },
    budget: {
      name: "بودجه‌ی ماه",
      limitMinor: "55000000",
      spentMinor: String(total),
      remainingPerDayMinor: String(
        Math.max(0, Math.round((55_000_000 - total) / Math.max(1, month.daysInMonth - month.day))),
      ),
      currencyCode: "IRT",
      periodStart: month.start,
    },
    categories: [
      {
        id: "c1",
        name: "خانه",
        icon: "home",
        color: "#8C9EFF",
        spentMinor: "18000000",
        limitMinor: "18000000",
        children: [{ id: "c1a", name: "اجاره", spentMinor: "18000000" }],
      },
      {
        id: "c2",
        name: "خرید روزمره",
        icon: "groceries",
        color: "#7BD389",
        spentMinor: "7420000",
        limitMinor: "9000000",
        children: [{ id: "c2a", name: "میوه و سبزی", spentMinor: "2100000" }],
      },
      {
        id: "c3",
        name: "سفر",
        icon: "travel",
        color: "#FFB86B",
        spentMinor: "6800000",
        limitMinor: null,
      },
      {
        id: "c4",
        name: "رستوران",
        icon: "restaurant",
        color: "#F28B82",
        spentMinor: "3950000",
        limitMinor: "3000000",
      },
      {
        id: "c5",
        name: "حمل‌ونقل",
        icon: "transport",
        color: "#81D4FA",
        spentMinor: "2260000",
        limitMinor: "3500000",
        children: [{ id: "c5a", name: "اسنپ", spentMinor: "1640000" }],
      },
      {
        id: "c6",
        name: "اشتراک",
        icon: "subscriptions",
        color: "#CE93D8",
        spentMinor: "890000",
        limitMinor: null,
      },
    ],
    transactions: [
      {
        id: "t1",
        direction: "debit",
        amountMinor: "485000",
        currencyCode: "IRT",
        title: "اسنپ‌فود",
        occurredAt: ago(0, 13),
        categoryName: "رستوران",
        categoryIcon: "restaurant",
      },
      {
        id: "t2",
        direction: "debit",
        amountMinor: "1240000",
        currencyCode: "IRT",
        title: "افق کوروش",
        occurredAt: ago(0, 10),
        categoryName: "خرید روزمره",
        categoryIcon: "groceries",
      },
      {
        id: "t3",
        direction: "credit",
        amountMinor: "62000000",
        currencyCode: "IRT",
        title: "حقوق آبان",
        occurredAt: ago(1, 9),
        categoryName: "حقوق",
        categoryIcon: "salary",
      },
      {
        id: "t4",
        direction: "debit",
        amountMinor: "214000",
        currencyCode: "IRT",
        title: "اسنپ",
        occurredAt: ago(1, 19),
        categoryName: "حمل‌ونقل",
        categoryIcon: "transport",
      },
      {
        id: "t5",
        direction: "debit",
        amountMinor: "390000",
        currencyCode: "IRT",
        title: "کافه لمیز",
        occurredAt: ago(2, 17),
        categoryName: "قهوه",
        categoryIcon: "coffee",
      },
      {
        id: "t6",
        direction: "debit",
        amountMinor: "299000",
        currencyCode: "IRT",
        title: "فیلیمو",
        occurredAt: ago(3, 22),
        categoryName: "اشتراک",
        categoryIcon: "subscriptions",
      },
      {
        id: "t7",
        direction: "debit",
        amountMinor: "2900000",
        currencyCode: "IRT",
        title: "قبض برق",
        occurredAt: ago(4, 12),
        categoryName: "قبوض",
        categoryIcon: "bills",
      },
    ],
    upcoming: [
      {
        id: "u1",
        title: "قسط وام مسکن",
        dueDate: ahead(3),
        amountMinor: "8500000",
        currencyCode: "IRT",
        categoryName: "اقساط",
        categoryIcon: "loans",
        categoryColor: "#F28B82",
      },
      {
        id: "u2",
        title: "قبض گاز",
        dueDate: ahead(6),
        amountMinor: "640000",
        currencyCode: "IRT",
        categoryName: "قبوض",
        categoryIcon: "bills",
        categoryColor: "#FFB86B",
      },
      {
        id: "u3",
        title: "اینترنت خانه",
        dueDate: ahead(11),
        amountMinor: "520000",
        currencyCode: "IRT",
        categoryName: "اشتراک",
        categoryIcon: "subscriptions",
        categoryColor: "#CE93D8",
      },
    ],
    obligations: {
      owedByMe: { amountMinor: "12000000", currencyCode: "IRT" },
      owedToMe: { amountMinor: "4500000", currencyCode: "IRT" },
      openCount: 3,
      items: [
        {
          id: "o1",
          kind: "debt",
          title: "قرض از علی",
          counterpartyName: "علی",
          amountMinor: "12000000",
          currencyCode: "IRT",
          nextDueDate: ahead(9),
        },
        {
          id: "o2",
          kind: "claim",
          title: "سهم شام",
          counterpartyName: "سارا",
          amountMinor: "1500000",
          currencyCode: "IRT",
          nextDueDate: null,
        },
        {
          id: "o3",
          kind: "claim",
          title: "بلیت کنسرت",
          counterpartyName: "رضا",
          amountMinor: "3000000",
          currencyCode: "IRT",
          nextDueDate: ahead(2),
        },
      ],
    },
    pendingApprovals: { count: 3 },
    news: { items: NEWS, version: "seed" },
  };
}
