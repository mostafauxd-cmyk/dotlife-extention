import { adSchema, slotById, TARGETS, type Ad } from "@dotlife/ads";
import type { z } from "zod";

import { graphemes, num, TARGET_LABEL } from "./labels";
import { slotForm } from "./slotForm";

/** Checks an ad with the shared schema and the slot's own rules, and says what is wrong in Persian. */

type Issue = z.core.$ZodIssue;

const FIELD: Record<string, string> = {
  id: "شناسه",
  slot: "جایگاه",
  products: "محصول",
  status: "وضعیت",
  advertiser: "آگهی‌دهنده",
  title: "عنوان",
  line: "توضیح",
  cta: "متن دکمه",
  url: "نشانی مقصد",
  glyph: "نماد",
  tint: "رنگ برند",
  image: "نشانی تصویر",
  from: "روز شروع",
  until: "روز پایان",
  weight: "وزن",
  model: "مدل فروش",
  price: "قیمت",
  dailyCap: "سقف روزانه",
  name: "نام کمپین",
  bid: "پیشنهاد قیمت",
  total: "بودجه‌ی کل",
  daily: "سقف روزانه‌ی بودجه",
  version: "نسخه",
  generatedAt: "زمان ساخت",
  ads: "فهرست تبلیغ‌ها",
};

export const issuePath = (path: readonly PropertyKey[]): string => path.map(String).join(".");

/** One schema issue as a Persian sentence about its field. */
export function issueMessage(issue: Issue): string {
  // the field's own name, whatever list or object it sits in («ads.0.url» → url)
  const key =
    issue.path
      .map(String)
      .filter((p) => !/^\d+$/.test(p))
      .at(-1) ?? "";
  const name = FIELD[key] ?? key;
  switch (issue.code) {
    case "invalid_type":
      return `${name} را درست وارد کن.`;
    case "too_small":
      if (issue.origin === "string" || issue.origin === "array")
        return issue.minimum === 1 ? `${name} لازم است.` : `${name} کوتاه است.`;
      return `${name} نباید از ${num(Number(issue.minimum))} کمتر باشد.`;
    case "too_big":
      return issue.origin === "string"
        ? `${name} بیش از ${num(Number(issue.maximum))} نویسه نباشد.`
        : `${name} نباید از ${num(Number(issue.maximum))} بیشتر باشد.`;
    case "invalid_format":
      if (key === "url" || key === "image") return `${name} معتبر نیست؛ مثل https://example.com/.`;
      if (key === "tint") return "رنگ را به شکل #D9862B وارد کن.";
      if (key === "from" || key === "until") return `${name} را به شکل ۲۰۲۶-۱۰-۲۳ وارد کن.`;
      return `${name} معتبر نیست.`;
    case "invalid_value":
      return `${name}: گزینه‌ی معتبر نیست.`;
    case "custom":
      return issue.message;
    case "invalid_union":
    case "invalid_key":
    case "invalid_element":
    case "unrecognized_keys":
    case "not_multiple_of":
      return `${name} معتبر نیست.`;
  }
}

export type Validation = { ok: true; ad: Ad } | { ok: false; errors: Record<string, string> };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** What the slot's rules read: an ad, or the raw input of one that did not pass the schema. */
type Loose = {
  slot: number;
  title?: string | undefined;
  line?: string | undefined;
  cta?: string | undefined;
  url?: string | undefined;
  image?: string | undefined;
  tint?: string | undefined;
  from?: string | undefined;
  until?: string | undefined;
  extra?: Record<string, string> | undefined;
  targeting?: Partial<Ad["targeting"]> | undefined;
};

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** The fields the slot's rules can read from raw input, whatever else in it is wrong. */
function loose(input: unknown): Loose | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const o = input as Record<string, unknown>;
  const slot = o["slot"];
  if (typeof slot !== "number") return undefined;
  const extra = o["extra"];
  const targeting = o["targeting"];
  return {
    slot,
    title: str(o["title"]),
    line: str(o["line"]),
    cta: str(o["cta"]),
    url: str(o["url"]),
    image: str(o["image"]),
    tint: str(o["tint"]),
    from: str(o["from"]),
    until: str(o["until"]),
    extra:
      typeof extra === "object" && extra !== null ? (extra as Record<string, string>) : undefined,
    targeting: typeof targeting === "object" && targeting !== null ? targeting : undefined,
  };
}

/** The slot's own rules, on top of the schema's. Messages are keyed by the field's path. */
function slotRules(ad: Loose, errors: Record<string, string>): void {
  const def = slotById(ad.slot);
  if (def === undefined) return;
  const form = slotForm(ad.slot);
  // a message the schema already gave for a field stays; these add what the schema cannot know
  const put = (key: string, message: string): void => {
    errors[key] ??= message;
  };

  const t = ad.targeting;
  for (const dim of TARGETS) {
    if (def.targets.includes(dim)) continue;
    const value = t?.[dim];
    if (value === true || (Array.isArray(value) && value.length > 0))
      put(`targeting.${dim}`, `این جایگاه را با «${TARGET_LABEL[dim]}» نمی‌شود هدف گرفت.`);
  }

  if (ad.title !== undefined && graphemes(ad.title).length > form.titleMax)
    put("title", `${form.titleLabel} در این جایگاه بیش از ${num(form.titleMax)} نویسه جا نمی‌شود.`);
  if (
    form.lineMax !== undefined &&
    ad.line !== undefined &&
    graphemes(ad.line).length > form.lineMax
  )
    put("line", `${form.lineLabel ?? "توضیح"} بیش از ${num(form.lineMax)} نویسه جا نمی‌شود.`);
  if (form.ctaMax !== undefined && ad.cta !== undefined && graphemes(ad.cta).length > form.ctaMax)
    put("cta", `متن دکمه بیش از ${num(form.ctaMax)} نویسه جا نمی‌شود.`);
  if (form.tint === "required" && ad.tint === undefined)
    put("tint", "این جایگاه رنگ برند می‌خواهد.");
  if (ad.url?.startsWith("http://") === true) put("url", "نشانی مقصد باید با https شروع شود.");
  if (ad.image?.startsWith("http://") === true) put("image", "نشانی تصویر باید با https شروع شود.");
  if (ad.from !== undefined && ad.until !== undefined && ad.from > ad.until)
    put("until", "روز پایان نباید پیش از روز شروع باشد.");

  for (const f of form.extra) {
    const v = ad.extra?.[f.key];
    const at = `extra.${f.key}`;
    if (v === undefined) {
      if (f.required === true) put(at, `${f.label} لازم است.`);
      continue;
    }
    if (f.kind === "number" && !Number.isFinite(Number(v))) put(at, `${f.label} باید عدد باشد.`);
    if (f.max !== undefined && graphemes(v).length > f.max)
      put(at, `${f.label} بیش از ${num(f.max)} نویسه جا نمی‌شود.`);
    if (f.kind === "date" && !DAY.test(v)) put(at, `${f.label} را به شکل ۲۰۲۶-۱۰-۲۳ وارد کن.`);
    if (f.kind === "select" && f.options?.includes(v) !== true)
      put(at, `${f.label}: یکی از گزینه‌ها را بردار.`);
  }
  // a promo picture needs its size, for the app to give it room
  if ((ad.slot === 101 || ad.slot === 102) && ad.image !== undefined) {
    for (const k of ["imageWidth", "imageHeight"])
      if (ad.extra?.[k] === undefined) put(`extra.${k}`, "اندازه‌ی عکس لازم است.");
  }
  const day = ad.extra?.["occasionDay"];
  if (day !== undefined && Number.isFinite(Number(day)) && (Number(day) < 1 || Number(day) > 31))
    put("extra.occasionDay", "روز مناسبت باید بین ۱ تا ۳۱ باشد.");
  const price = ad.extra?.["price"];
  if (ad.slot === 11 && price !== undefined && Number.isFinite(Number(price)) && Number(price) <= 0)
    put("extra.price", "قیمت واحد باید بیشتر از صفر باشد.");
}

export function validateAd(input: unknown): Validation {
  const parsed = adSchema.safeParse(input);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issuePath(issue.path);
      errors[key] ??= issueMessage(issue);
    }
    // the slot's rules still run, so one pass shows everything that is wrong
    const l = loose(input);
    if (l !== undefined) slotRules(l, errors);
    return { ok: false, errors };
  }
  slotRules(parsed.data, errors);
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, ad: parsed.data };
}
