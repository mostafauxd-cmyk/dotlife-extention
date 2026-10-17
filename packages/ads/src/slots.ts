/**
 * The places an ad can sit across the products — the design's «جایگاه‌های تبلیغ»
 * (design/prototypes/newtab.html). Every slot has a fixed id, so an admin panel can sell it by that
 * id and a client can draw it without knowing who bought it. All are native: the shape and size of
 * what they sit beside, with only the «معرفی‌شده» label telling them apart.
 */

export const PRODUCTS = ["newtab", "noghte", "paket"] as const;
export type Product = (typeof PRODUCTS)[number];

export const SALE_MODELS = [
  "per-click",
  "per-thousand",
  "per-purchase",
  "per-signup",
  "per-sale",
  "daily-sponsor",
  "monthly-sponsor",
  "occasion-sponsor",
] as const;
export type SaleModel = (typeof SALE_MODELS)[number];

export const TARGETS = ["persona", "city", "season", "occasion", "keyword", "topic", "weekend"] as const;
export type Target = (typeof TARGETS)[number];

export type Slot = {
  /** 1–15, the number the design's mock-up shows on each. */
  id: number;
  product: Product;
  /** The slide it is on («خانه»، «برنامه‌ها»…). */
  slide: string;
  name: string;
  /** What it looks like. */
  shape: string;
  /** How many at once. */
  cap: string;
  /** What it may be aimed by — never the text of a note, task, plan, transaction or holding. */
  targets: readonly Target[];
  model: SaleModel;
  /** Fills with the products' own promotion (Noghte, Paket) when nothing is sold. */
  house: boolean;
};

export const SLOTS: readonly Slot[] = [
  { id: 1, product: "newtab", slide: "خانه", name: "کاشی دسترسی سریع", shape: "یک کاشی هم‌شکل بقیه در ردیف زیر سرچ، با نقطه‌ی کهربایی", cap: "۱ در ردیف", targets: ["persona", "city"], model: "per-click", house: false },
  { id: 2, product: "newtab", slide: "خانه", name: "کاشی داخل پوشه", shape: "یک کاشی با برچسب «معرفی‌شده» داخل یکی از پوشه‌های شغل", cap: "۱ در هر شغل", targets: ["persona"], model: "per-click", house: false },
  { id: 3, product: "newtab", slide: "خانه", name: "تم روز", shape: "رنگ زمینه و نقطه به رنگ برند، با یک خط کردیت پایین صفحه", cap: "۱ روز در هفته؛ قابل خاموش کردن", targets: [], model: "daily-sponsor", house: false },
  { id: 4, product: "newtab", slide: "خانه", name: "پیشنهاد سرچ", shape: "یک ردیف بین پیشنهادهای سرچ", cap: "۱ در هر جستجو", targets: ["keyword"], model: "per-click", house: false },
  { id: 5, product: "newtab", slide: "خانه", name: "زیر مناسبت امروز", shape: "یک خط در کارت گوشه‌ی «امروز»", cap: "روزهای دارای مناسبت", targets: ["occasion", "city"], model: "daily-sponsor", house: false },
  { id: 6, product: "newtab", slide: "خانه", name: "کارت پیشنهاد در لبه", shape: "یک کارت کوچک پایین نوار لبه‌ی راست", cap: "۱؛ چرخش روزانه", targets: ["city", "persona", "season"], model: "per-thousand", house: true },
  { id: 7, product: "newtab", slide: "برنامه‌ها", name: "رویداد شهر", shape: "کارت کوچک کنسرت، نمایش یا نمایشگاه با دکمه‌ی «+ برنامه»", cap: "۱", targets: ["city", "weekend"], model: "per-purchase", house: false },
  { id: 8, product: "newtab", slide: "برنامه‌ها", name: "پیشنهاد زیر مناسبت", shape: "یک خط کوچک زیر مناسبت مرتبط در فهرست مناسبت‌ها", cap: "۱ در فهرست", targets: ["occasion"], model: "occasion-sponsor", house: false },
  { id: 9, product: "newtab", slide: "برنامه‌ها", name: "ردیف سرچ برنامه‌ها", shape: "یک ردیف آخر نتایج سرچ برنامه‌ها", cap: "۱ در هر جستجو", targets: ["keyword"], model: "per-click", house: false },
  { id: 10, product: "newtab", slide: "پول", name: "آیتم همکار در نوار قیمت", shape: "یک آیتم زرد با برچسب «معرفی‌شده» بین نمادهای نوار متحرک", cap: "۱ همکار", targets: [], model: "per-sale", house: false },
  { id: 11, product: "newtab", slide: "پول", name: "نماد معرفی‌شده", shape: "یک ردیف در فهرست قیمت روز، مثل صندوق طلا یا صندوق درآمد ثابت", cap: "۱", targets: [], model: "monthly-sponsor", house: false },
  { id: 12, product: "newtab", slide: "پول", name: "کارت آخر ردیف خبر", shape: "یک کارت جدا با حاشیه‌ی خط‌چین در انتهای ردیف خبرها", cap: "۱", targets: [], model: "per-thousand", house: false },
  { id: 13, product: "newtab", slide: "یادداشت‌ها", name: "قالب پیشنهادی", shape: "کارت یک قالب یادداشت در ستون پوشه‌ها؛ «استفاده» یادداشت تازه می‌سازد", cap: "۱", targets: ["persona", "season"], model: "monthly-sponsor", house: false },
  { id: 14, product: "newtab", slide: "خبر", name: "کارت فید", shape: "یک ردیف هم‌شکل خبرها با حاشیه‌ی خط‌چین، بعد از خبر سوم و هر ۸ خبر", cap: "۱ در هر ۸ خبر", targets: ["topic", "city"], model: "per-thousand", house: false },
  { id: 15, product: "newtab", slide: "شبکه‌ها", name: "کانال یا پیج پیشنهادی", shape: "یک کارت کوچک بالای قاب‌ها با دکمه‌ی «عضویت»؛ هرگز داخل قاب خود سرویس", cap: "۱", targets: ["persona", "topic"], model: "per-signup", house: false },
];

export const slotById = (id: number): Slot | undefined => SLOTS.find((s) => s.id === id);

/** At most this many slots are filled together on one slide. */
export const MAX_PER_SLIDE = 3;
