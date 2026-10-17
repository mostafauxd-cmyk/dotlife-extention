import {
  AD_PERSONAS,
  slotById,
  type Ad,
  type AdStatus,
  type Product,
  type SaleModel,
  type Target,
} from "@dotlife/ads";

/**
 * How the create/edit form adapts to a slot: which of the common fields the slot's box has, how long
 * its words may be, and the slot's own `extra` fields (a folder, an event's kind and day, a symbol's
 * price, a template's body).
 */

export type ExtraField = {
  key: string;
  label: string;
  kind: "text" | "number" | "date" | "select" | "textarea";
  required?: boolean;
  options?: readonly string[];
  suggestions?: readonly string[];
  hint?: string;
  placeholder?: string;
};

export type SlotForm = {
  titleLabel: string;
  /** The longest title the slot's box can hold. */
  titleMax: number;
  lineLabel?: string;
  ctaLabel?: string;
  ctaPlaceholder?: string;
  glyph?: boolean;
  /** The brand colour: used when the slot draws a mark or a themed page. */
  tint?: "optional" | "required";
  image?: boolean;
  extra: readonly ExtraField[];
};

const EVENT_KINDS = ["کنسرت", "تئاتر", "نمایشگاه", "سینما", "ورزش", "جشنواره"] as const;

export const SLOT_FORM: Record<number, SlotForm> = {
  1: {
    titleLabel: "نام کاشی",
    titleMax: 16,
    glyph: true,
    tint: "required",
    image: true,
    extra: [],
  },
  2: {
    titleLabel: "نام کاشی",
    titleMax: 16,
    glyph: true,
    tint: "required",
    image: true,
    extra: [
      {
        key: "folder",
        label: "پوشه‌ی شغل",
        kind: "text",
        required: true,
        suggestions: AD_PERSONAS.map((p) => p.folder),
        hint: "کاشی داخل این پوشه‌ی دسترسی سریع می‌نشیند.",
      },
    ],
  },
  3: {
    titleLabel: "نام کمپین",
    titleMax: 40,
    lineLabel: "خط کردیت (اختیاری)",
    tint: "required",
    extra: [],
  },
  4: { titleLabel: "متن ردیف پیشنهاد", titleMax: 70, lineLabel: "توضیح کوتاه", extra: [] },
  5: { titleLabel: "متن خط", titleMax: 50, extra: [] },
  6: {
    titleLabel: "عنوان کارت",
    titleMax: 70,
    lineLabel: "توضیح",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "ببین",
    extra: [],
  },
  7: {
    titleLabel: "نام رویداد",
    titleMax: 60,
    lineLabel: "روز، ساعت و محل",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "+ برنامه",
    glyph: true,
    tint: "optional",
    image: true,
    extra: [
      { key: "kind", label: "نوع رویداد", kind: "select", required: true, options: EVENT_KINDS },
      {
        key: "date",
        label: "روز رویداد",
        kind: "date",
        required: true,
        hint: "«+ برنامه» همین روز را به تقویم کاربر اضافه می‌کند.",
      },
    ],
  },
  8: {
    titleLabel: "متن خط",
    titleMax: 50,
    extra: [
      {
        key: "occasionDay",
        label: "روز مناسبت",
        kind: "number",
        placeholder: "۲۶",
        hint: "شماره‌ی روز ماه، برای جای خط در فهرست مناسبت‌ها.",
      },
    ],
  },
  9: { titleLabel: "متن ردیف", titleMax: 70, extra: [] },
  10: { titleLabel: "عنوان آیتم", titleMax: 36, lineLabel: "توضیح کوتاه", extra: [] },
  11: {
    titleLabel: "نام نماد",
    titleMax: 40,
    lineLabel: "توضیح زیر نام",
    glyph: true,
    tint: "required",
    extra: [
      { key: "price", label: "قیمت واحد (تومان)", kind: "number", required: true },
      {
        key: "change",
        label: "تغییر امروز (٪)",
        kind: "number",
        placeholder: "0.9",
        hint: "با علامت: منفی یعنی کاهش.",
      },
    ],
  },
  12: {
    titleLabel: "عنوان کارت",
    titleMax: 80,
    lineLabel: "از طرف …",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "افتتاح حساب",
    extra: [],
  },
  13: {
    titleLabel: "نام قالب",
    titleMax: 50,
    lineLabel: "از طرف …",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "استفاده از قالب",
    extra: [
      {
        key: "body",
        label: "متن قالب",
        kind: "textarea",
        required: true,
        hint: "هر خط یک مورد. «استفاده» یادداشت تازه را با همین خط‌ها می‌سازد.",
      },
    ],
  },
  14: {
    titleLabel: "عنوان خبر",
    titleMax: 90,
    lineLabel: "خلاصه",
    glyph: true,
    tint: "optional",
    image: true,
    extra: [],
  },
  15: {
    titleLabel: "نام کانال یا پیج",
    titleMax: 50,
    lineLabel: "توضیح کوتاه",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "عضویت",
    glyph: true,
    tint: "optional",
    image: true,
    extra: [],
  },
  // Noghte's phone app
  101: {
    titleLabel: "عنوان کارت",
    titleMax: 60,
    lineLabel: "متن کارت",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "ببین",
    glyph: true,
    tint: "optional",
    image: true,
    extra: [],
  },
  102: {
    titleLabel: "عنوان کارت",
    titleMax: 60,
    lineLabel: "متن کارت",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "ببین",
    glyph: true,
    tint: "optional",
    image: true,
    extra: [],
  },
  103: { titleLabel: "متن ردیف", titleMax: 50, extra: [] },
  104: { titleLabel: "متن ردیف", titleMax: 60, lineLabel: "توضیح کوتاه", extra: [] },
  105: {
    titleLabel: "عنوان کارت",
    titleMax: 60,
    lineLabel: "توضیح",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "ببین",
    glyph: true,
    tint: "optional",
    extra: [],
  },
  106: {
    titleLabel: "عنوان ردیف",
    titleMax: 50,
    lineLabel: "توضیح کوتاه",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "عضویت",
    glyph: true,
    tint: "optional",
    extra: [],
  },
  // Paket's phone app
  201: {
    titleLabel: "عنوان کارت",
    titleMax: 80,
    lineLabel: "از طرف …",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "ببین",
    extra: [],
  },
  202: {
    titleLabel: "نام کاشی",
    titleMax: 24,
    glyph: true,
    tint: "required",
    image: true,
    extra: [],
  },
  203: {
    titleLabel: "عنوان پیشنهاد",
    titleMax: 70,
    lineLabel: "توضیح",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "ببین",
    extra: [],
  },
  204: {
    titleLabel: "عنوان پیشنهاد",
    titleMax: 70,
    lineLabel: "توضیح",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "ببین",
    extra: [],
  },
  205: { titleLabel: "متن نکته", titleMax: 70, lineLabel: "توضیح", extra: [] },
  206: {
    titleLabel: "عنوان ردیف",
    titleMax: 50,
    lineLabel: "توضیح کوتاه",
    ctaLabel: "متن دکمه",
    ctaPlaceholder: "عضویت",
    glyph: true,
    tint: "optional",
    extra: [],
  },
};

export const slotForm = (slot: number): SlotForm =>
  SLOT_FORM[slot] ?? { titleLabel: "عنوان", titleMax: 80, extra: [] };

/** Everything the form holds, as the text the person typed. */
export type Draft = {
  id: string;
  slot: number;
  /** The campaign it is a creative of, or "" for an ad on its own. */
  campaign: string;
  products: Product[];
  status: AdStatus;
  advertiser: string;
  title: string;
  line: string;
  cta: string;
  url: string;
  glyph: string;
  tint: string;
  image: string;
  extra: Record<string, string>;
  persona: string[];
  city: string[];
  season: string[];
  occasion: string[];
  keyword: string[];
  topic: string[];
  weekend: boolean;
  from: string;
  until: string;
  weight: string;
  model: SaleModel;
  price: string;
  dailyCap: string;
};

export function blankDraft(slot: number, id: string, campaign = ""): Draft {
  const def = slotById(slot);
  return {
    id,
    slot,
    campaign,
    products: [def?.product ?? "newtab"],
    status: "draft",
    advertiser: "",
    title: "",
    line: "",
    cta: "",
    url: "https://",
    glyph: "",
    tint: "",
    image: "",
    extra: {},
    persona: [],
    city: [],
    season: [],
    occasion: [],
    keyword: [],
    topic: [],
    weekend: false,
    from: "",
    until: "",
    weight: "1",
    model: def?.model ?? "per-click",
    price: "",
    dailyCap: "",
  };
}

export function draftFromAd(ad: Ad): Draft {
  const t = ad.targeting;
  return {
    id: ad.id,
    slot: ad.slot,
    campaign: ad.campaign ?? "",
    products: [...ad.products],
    status: ad.status,
    advertiser: ad.advertiser,
    title: ad.title,
    line: ad.line ?? "",
    cta: ad.cta ?? "",
    url: ad.url,
    glyph: ad.glyph ?? "",
    tint: ad.tint ?? "",
    image: ad.image ?? "",
    extra: { ...ad.extra },
    persona: [...t.persona],
    city: [...t.city],
    season: [...t.season],
    occasion: [...t.occasion],
    keyword: [...t.keyword],
    topic: [...t.topic],
    weekend: t.weekend,
    from: ad.from ?? "",
    until: ad.until ?? "",
    weight: String(ad.weight),
    model: ad.model,
    price: ad.price === undefined ? "" : String(ad.price),
    dailyCap: ad.dailyCap === undefined ? "" : String(ad.dailyCap),
  };
}

const text = (s: string): string | undefined => (s.trim() === "" ? undefined : s.trim());
const number = (s: string): number | undefined => (s.trim() === "" ? undefined : Number(s.trim()));

/**
 * The draft as the value the schema checks: blanks dropped, numbers made numbers, and only what the
 * slot has — so a field the slot does not show can never fail the form unseen.
 */
export function draftToInput(d: Draft): Record<string, unknown> {
  const def = slotById(d.slot);
  const form = slotForm(d.slot);
  // a campaign's creative takes its targeting, days and price from the campaign
  const own = d.campaign === "";
  const allowed = new Set<string>(own ? (def?.targets ?? []) : []);
  const keep = (dim: Target, list: string[]): string[] =>
    allowed.has(dim) ? list.map((x) => x.trim()).filter((x) => x !== "") : [];
  const extra: Record<string, string> = {};
  for (const f of form.extra) {
    const v = text(d.extra[f.key] ?? "");
    if (v !== undefined) extra[f.key] = v;
  }
  return {
    id: d.id,
    slot: d.slot,
    products: own ? d.products : def === undefined ? d.products : [def.product],
    status: d.status,
    advertiser: d.advertiser.trim(),
    title: d.title.trim(),
    line: form.lineLabel === undefined ? undefined : text(d.line),
    cta: form.ctaLabel === undefined ? undefined : text(d.cta),
    url: d.url.trim(),
    glyph: form.glyph === true ? text(d.glyph) : undefined,
    tint: form.tint === undefined ? undefined : text(d.tint),
    image: form.image === true ? text(d.image) : undefined,
    extra: Object.keys(extra).length > 0 ? extra : undefined,
    targeting: {
      persona: keep("persona", d.persona),
      city: keep("city", d.city),
      season: keep("season", d.season),
      occasion: keep("occasion", d.occasion),
      keyword: keep("keyword", d.keyword),
      topic: keep("topic", d.topic),
      weekend: allowed.has("weekend") && d.weekend,
    },
    from: own ? text(d.from) : undefined,
    until: own ? text(d.until) : undefined,
    weight: number(d.weight),
    model: d.model,
    price: own ? number(d.price) : undefined,
    dailyCap: number(d.dailyCap),
    campaign: own ? undefined : d.campaign,
  };
}
