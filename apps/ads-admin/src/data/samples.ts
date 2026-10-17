import { adSchema, campaignSchema, type Ad, type Campaign } from "@dotlife/ads";

/**
 * Example campaigns across the three products, so the campaigns, the shares and the dashboard can
 * be seen before any are sold. Their advertiser is «نمونه» so no one mistakes them for real ones.
 */

export const SAMPLE_CAMPAIGNS: readonly Campaign[] = [
  campaignSchema.parse({
    id: "sample-c-travel",
    name: "سفر پاییزی",
    advertiser: "نمونه · آژانس سفر",
    status: "live",
    model: "per-thousand",
    bid: 25000,
    budget: { total: 300_000_000, daily: 1_200_000 },
    products: [
      {
        product: "newtab",
        slots: [6, 14],
        targeting: { city: ["تهران", "مشهد"], season: ["autumn"] },
      },
      { product: "noghte", slots: [102], targeting: {} },
      { product: "paket", slots: [201], targeting: { topic: ["سفر"] } },
    ],
  }),
  campaignSchema.parse({
    id: "sample-c-insurance",
    name: "بیمه‌ی بدنه‌ی آنلاین",
    advertiser: "نمونه · بیمه",
    status: "live",
    model: "per-click",
    bid: 1800,
    budget: { total: 120_000_000, daily: 2_000_000 },
    products: [
      { product: "newtab", slots: [4, 6], targeting: { keyword: ["بیمه", "ماشین", "بدنه"] } },
      { product: "paket", slots: [203], targeting: {} },
    ],
  }),
  campaignSchema.parse({
    id: "sample-c-calendar",
    name: "اسپانسر داشبورد تقویم",
    advertiser: "نمونه · بانک",
    status: "live",
    model: "daily-sponsor",
    bid: 3_500_000,
    budget: { total: 105_000_000 },
    products: [{ product: "noghte", slots: [101], targeting: {} }],
  }),
];

const creative = (a: Record<string, unknown>): Ad =>
  adSchema.parse({ status: "live", url: "https://example.com/", products: ["newtab"], ...a });

export const SAMPLE_CREATIVES: readonly Ad[] = [
  creative({
    id: "sample-cr-1",
    campaign: "sample-c-travel",
    slot: 6,
    advertiser: "نمونه · آژانس سفر",
    title: "تور کیش آخر هفته از ۴٫۹ میلیون",
    line: "پرواز و هتل",
    cta: "ببین",
    model: "per-thousand",
  }),
  creative({
    id: "sample-cr-2",
    campaign: "sample-c-travel",
    slot: 14,
    advertiser: "نمونه · آژانس سفر",
    title: "بلیت هواپیمای کیش برای آخر هفته",
    line: "رفت‌وبرگشت با هتل؛ رزرو آنلاین",
    glyph: "ک",
    tint: "#C27A5A",
    model: "per-thousand",
  }),
  creative({
    id: "sample-cr-3",
    campaign: "sample-c-travel",
    slot: 102,
    products: ["noghte"],
    advertiser: "نمونه · آژانس سفر",
    title: "هوای کیش این هفته آفتابی است",
    line: "تور سه‌روزه از ۴٫۹ میلیون",
    cta: "رزرو",
    extra: { look: "متن‌محور (عکس کوچک کنار متن)" },
    glyph: "ک",
    tint: "#2AABEE",
    model: "per-thousand",
  }),
  creative({
    id: "sample-cr-4",
    campaign: "sample-c-travel",
    slot: 201,
    products: ["paket"],
    advertiser: "نمونه · آژانس سفر",
    title: "سفر پاییزی را قسطی بخر",
    line: "از طرف یک آژانس سفر",
    cta: "دیدن تورها",
    model: "per-thousand",
  }),
  creative({
    id: "sample-cr-5",
    campaign: "sample-c-insurance",
    slot: 4,
    advertiser: "نمونه · بیمه",
    title: "بیمه‌ی بدنه‌ی آنلاین، استعلام در ۲ دقیقه",
    model: "per-click",
  }),
  creative({
    id: "sample-cr-6",
    campaign: "sample-c-insurance",
    slot: 6,
    advertiser: "نمونه · بیمه",
    title: "بیمه‌ی بدنه با ۲۰٪ تخفیف آنلاین",
    cta: "استعلام",
    model: "per-click",
  }),
  creative({
    id: "sample-cr-7",
    campaign: "sample-c-insurance",
    slot: 203,
    products: ["paket"],
    advertiser: "نمونه · بیمه",
    title: "بیمه‌ی ماشین را ماهانه بپرداز",
    line: "بدون پیش‌پرداخت",
    cta: "استعلام",
    model: "per-click",
  }),
  creative({
    id: "sample-cr-8",
    campaign: "sample-c-calendar",
    slot: 101,
    products: ["noghte"],
    advertiser: "نمونه · بانک",
    title: "سپرده‌ی روزشمار؛ سود هر روز",
    line: "افتتاح آنلاین در ۵ دقیقه",
    cta: "افتتاح حساب",
    extra: { look: "متن‌محور (عکس کوچک کنار متن)" },
    tint: "#3E7BFA",
    model: "daily-sponsor",
  }),
];
