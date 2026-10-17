import { adSchema, slotById, TARGETS, type Ad } from "@dotlife/ads";
import type { z } from "zod";

import { num, TARGET_LABEL } from "./labels";
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

/** The slot's own rules, on top of the schema's. Messages are keyed by the field's path. */
function slotRules(ad: Ad, errors: Record<string, string>): void {
  const def = slotById(ad.slot);
  const form = slotForm(ad.slot);
  if (def === undefined) return;

  const t = ad.targeting;
  for (const dim of TARGETS) {
    if (def.targets.includes(dim)) continue;
    const value = t[dim];
    if (value === true || (Array.isArray(value) && value.length > 0))
      errors[`targeting.${dim}`] = `این جایگاه را با «${TARGET_LABEL[dim]}» نمی‌شود هدف گرفت.`;
  }

  if (ad.title.length > form.titleMax)
    errors["title"] =
      `${form.titleLabel} در این جایگاه بیش از ${num(form.titleMax)} نویسه جا نمی‌شود.`;
  if (form.tint === "required" && ad.tint === undefined)
    errors["tint"] = "این جایگاه رنگ برند می‌خواهد.";
  if (ad.url.startsWith("http://")) errors["url"] = "نشانی مقصد باید با https شروع شود.";
  if (ad.image?.startsWith("http://") === true)
    errors["image"] = "نشانی تصویر باید با https شروع شود.";
  if (ad.from !== undefined && ad.until !== undefined && ad.from > ad.until)
    errors["until"] = "روز پایان نباید پیش از روز شروع باشد.";

  for (const f of form.extra) {
    const v = ad.extra?.[f.key];
    const at = `extra.${f.key}`;
    if (v === undefined) {
      if (f.required === true) errors[at] = `${f.label} لازم است.`;
      continue;
    }
    if (f.kind === "number" && !Number.isFinite(Number(v)))
      errors[at] = `${f.label} باید عدد باشد.`;
    if (f.kind === "date" && !DAY.test(v)) errors[at] = `${f.label} را به شکل ۲۰۲۶-۱۰-۲۳ وارد کن.`;
    if (f.kind === "select" && f.options?.includes(v) !== true)
      errors[at] = `${f.label}: یکی از گزینه‌ها را بردار.`;
  }
  const day = ad.extra?.["occasionDay"];
  if (day !== undefined && (Number(day) < 1 || Number(day) > 31))
    errors["extra.occasionDay"] = "روز مناسبت باید بین ۱ تا ۳۱ باشد.";
  if (ad.slot === 11 && ad.extra?.["price"] !== undefined && Number(ad.extra["price"]) <= 0)
    errors["extra.price"] = "قیمت واحد باید بیشتر از صفر باشد.";
}

export function validateAd(input: unknown): Validation {
  const parsed = adSchema.safeParse(input);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issuePath(issue.path);
      if (errors[key] === undefined) errors[key] = issueMessage(issue);
    }
    return { ok: false, errors };
  }
  slotRules(parsed.data, errors);
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, ad: parsed.data };
}
