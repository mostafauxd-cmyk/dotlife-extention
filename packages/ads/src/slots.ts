/**
 * The places an ad can sit across the products — the design's «جایگاه‌های تبلیغ»
 * (design/prototypes/newtab.html). Every slot has a fixed id, so an admin panel can sell it by that
 * id and a client can draw it without knowing who bought it. All are native: the shape and size of
 * what they sit beside, with only the «معرفی‌شده» label telling them apart.
 */

export const PRODUCTS = ["newtab", "noghte", "paket"] as const;
export type Product = (typeof PRODUCTS)[number];

/** What each product is; a new app joins by a line here and its placements below. */
export const PRODUCT_INFO: Record<Product, { name: string; platform: string; slotBase: number }> = {
  newtab: { name: "نیوتب نقطه", platform: "افزونه‌ی کروم", slotBase: 0 },
  noghte: { name: "اپ نقطه", platform: "اپ موبایل", slotBase: 100 },
  paket: { name: "پاکت", platform: "اپ موبایل", slotBase: 200 },
};

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
  /** About how many times a day the place is seen, for forecasting shares; real counts replace it. */
  inventory?: number;
};

export const SLOTS: readonly Slot[] = [
  { id: 1, inventory: 40000, product: "newtab", slide: "خانه", name: "کاشی دسترسی سریع", shape: "یک کاشی هم‌شکل بقیه در ردیف زیر سرچ، با نقطه‌ی کهربایی", cap: "۱ در ردیف", targets: ["persona", "city"], model: "per-click", house: false },
  { id: 2, inventory: 8000, product: "newtab", slide: "خانه", name: "کاشی داخل پوشه", shape: "یک کاشی با برچسب «معرفی‌شده» داخل یکی از پوشه‌های شغل", cap: "۱ در هر شغل", targets: ["persona"], model: "per-click", house: false },
  { id: 3, inventory: 60000, product: "newtab", slide: "خانه", name: "تم روز", shape: "رنگ زمینه و نقطه به رنگ برند، با یک خط کردیت پایین صفحه", cap: "۱ روز در هفته؛ قابل خاموش کردن", targets: [], model: "daily-sponsor", house: false },
  { id: 4, inventory: 12000, product: "newtab", slide: "خانه", name: "پیشنهاد سرچ", shape: "یک ردیف بین پیشنهادهای سرچ", cap: "۱ در هر جستجو", targets: ["keyword"], model: "per-click", house: false },
  { id: 5, inventory: 20000, product: "newtab", slide: "خانه", name: "زیر مناسبت امروز", shape: "یک خط در کارت گوشه‌ی «امروز»", cap: "روزهای دارای مناسبت", targets: ["occasion", "city"], model: "daily-sponsor", house: false },
  { id: 6, inventory: 30000, product: "newtab", slide: "خانه", name: "کارت پیشنهاد در لبه", shape: "یک کارت کوچک پایین نوار لبه‌ی راست", cap: "۱؛ چرخش روزانه", targets: ["city", "persona", "season"], model: "per-thousand", house: true },
  { id: 7, inventory: 9000, product: "newtab", slide: "برنامه‌ها", name: "رویداد شهر", shape: "کارت کوچک کنسرت، نمایش یا نمایشگاه با دکمه‌ی «+ برنامه»", cap: "۱", targets: ["city", "weekend"], model: "per-purchase", house: false },
  { id: 8, inventory: 6000, product: "newtab", slide: "برنامه‌ها", name: "پیشنهاد زیر مناسبت", shape: "یک خط کوچک زیر مناسبت مرتبط در فهرست مناسبت‌ها", cap: "۱ در فهرست", targets: ["occasion"], model: "occasion-sponsor", house: false },
  { id: 9, inventory: 3000, product: "newtab", slide: "برنامه‌ها", name: "ردیف سرچ برنامه‌ها", shape: "یک ردیف آخر نتایج سرچ برنامه‌ها", cap: "۱ در هر جستجو", targets: ["keyword"], model: "per-click", house: false },
  { id: 10, inventory: 15000, product: "newtab", slide: "پول", name: "آیتم همکار در نوار قیمت", shape: "یک آیتم زرد با برچسب «معرفی‌شده» بین نمادهای نوار متحرک", cap: "۱ همکار", targets: [], model: "per-sale", house: false },
  { id: 11, inventory: 15000, product: "newtab", slide: "پول", name: "نماد معرفی‌شده", shape: "یک ردیف در فهرست قیمت روز، مثل صندوق طلا یا صندوق درآمد ثابت", cap: "۱", targets: [], model: "monthly-sponsor", house: false },
  { id: 12, inventory: 10000, product: "newtab", slide: "پول", name: "کارت آخر ردیف خبر", shape: "یک کارت جدا با حاشیه‌ی خط‌چین در انتهای ردیف خبرها", cap: "۱", targets: [], model: "per-thousand", house: false },
  { id: 13, inventory: 5000, product: "newtab", slide: "یادداشت‌ها", name: "قالب پیشنهادی", shape: "کارت یک قالب یادداشت در ستون پوشه‌ها؛ «استفاده» یادداشت تازه می‌سازد", cap: "۱", targets: ["persona", "season"], model: "monthly-sponsor", house: false },
  { id: 14, inventory: 12000, product: "newtab", slide: "خبر", name: "کارت فید", shape: "یک ردیف هم‌شکل خبرها با حاشیه‌ی خط‌چین، بعد از خبر سوم و هر ۸ خبر", cap: "۱ در هر ۸ خبر", targets: ["topic", "city"], model: "per-thousand", house: false },
  { id: 15, inventory: 7000, product: "newtab", slide: "شبکه‌ها", name: "کانال یا پیج پیشنهادی", shape: "یک کارت کوچک بالای قاب‌ها با دکمه‌ی «عضویت»؛ هرگز داخل قاب خود سرویس", cap: "۱", targets: ["persona", "topic"], model: "per-signup", house: false },
];

/**
 * Noghte's phone app: the places a native card can sit beside the app's own boxes, never inside
 * notes, tasks or the planner (apps/mobile in the Dotlife repo). 101 and 102 are where its
 * `promo` cards already go.
 */
export const NOGHTE_SLOTS: readonly Slot[] = [
  { id: 101, inventory: 50000, product: "noghte", slide: "تقویم", name: "کارت بالای داشبورد", shape: "یک کارت هم‌شکل جعبه‌های داشبورد تقویم، بالای آن‌ها (جای promo «top»)", cap: "۱", targets: ["city", "season", "occasion"], model: "daily-sponsor", house: true },
  { id: 102, inventory: 30000, product: "noghte", slide: "تقویم", name: "کارت پایان داشبورد", shape: "یک کارت در انتهای داشبورد تقویم (جای promo «end»)", cap: "۱", targets: ["city", "season", "topic"], model: "per-thousand", house: true },
  { id: 103, inventory: 12000, product: "noghte", slide: "مناسبت‌ها", name: "ردیف زیر مناسبت", shape: "یک ردیف هم‌شکل مناسبت‌ها، زیر مناسبت مرتبط", cap: "۱ در فهرست", targets: ["occasion"], model: "occasion-sponsor", house: false },
  { id: 104, inventory: 25000, product: "noghte", slide: "تقویم", name: "ردیف رویدادهای امروز", shape: "یک ردیف در کارت رویدادهای فرهنگی و رسمی امروز", cap: "۱", targets: ["occasion", "city"], model: "per-click", house: false },
  { id: 105, inventory: 15000, product: "noghte", slide: "آب‌وهوا", name: "کارت زیر پیش‌بینی", shape: "یک کارت بعد از پیش‌بینی چندروزه", cap: "۱", targets: ["city", "season", "weekend"], model: "per-thousand", house: false },
  { id: 106, inventory: 6000, product: "noghte", slide: "پروفایل", name: "ردیف پیشنهاد در پروفایل", shape: "یک ردیف هم‌شکل کارت‌های پروفایل", cap: "۱", targets: ["topic", "city"], model: "per-signup", house: true },
];

/**
 * Paket's phone app: beside the news, the plans and the forecasts, never next to a balance, a
 * transaction or a budget line (apps/mobile in the PFM repo). 203 is where its
 * `RecommendationSlot` already sits.
 */
export const PAKET_SLOTS: readonly Slot[] = [
  { id: 201, inventory: 40000, product: "paket", slide: "خانه", name: "کارت خبر و پیشنهاد", shape: "یک کارت هم‌شکل خبرهای صفحه‌ی خانه، آخر ردیف، با حاشیه‌ی خط‌چین", cap: "۱", targets: ["topic"], model: "per-thousand", house: true },
  { id: 202, inventory: 30000, product: "paket", slide: "خانه", name: "کاشی نیم‌ردیف", shape: "یک کاشی کوچک کنار کارت‌های نیم‌ردیف خانه", cap: "۱", targets: ["topic"], model: "per-click", house: false },
  { id: 203, inventory: 10000, product: "paket", slide: "بودجه‌ها", name: "پیشنهاد پایین بودجه‌ها", shape: "یک کارت بعد از فهرست دسته‌ها (جای RecommendationSlot)", cap: "۱", targets: ["topic", "season"], model: "per-click", house: false },
  { id: 204, inventory: 8000, product: "paket", slide: "خرج‌های پیش رو", name: "کارت پایان خرج‌های پیش رو", shape: "یک کارت بعد از فهرست خرج‌های پیش رو", cap: "۱", targets: ["season", "occasion"], model: "per-click", house: false },
  { id: 205, inventory: 5000, product: "paket", slide: "پیش‌بینی", name: "نکته‌ی پایین پیش‌بینی", shape: "یک کارت نکته در پای صفحه‌ی پیش‌بینی", cap: "۱", targets: [], model: "per-thousand", house: false },
  { id: 206, inventory: 6000, product: "paket", slide: "پروفایل", name: "ردیف پیشنهاد در پروفایل", shape: "یک ردیف هم‌شکل کارت دعوت پروفایل", cap: "۱", targets: ["topic"], model: "per-signup", house: true },
];

/** Every place in every product. */
export const PLACEMENTS: readonly Slot[] = [...SLOTS, ...NOGHTE_SLOTS, ...PAKET_SLOTS];

export const slotById = (id: number): Slot | undefined => PLACEMENTS.find((s) => s.id === id);

export const placementsOf = (product: Product): Slot[] =>
  PLACEMENTS.filter((s) => s.product === product);

/** At most this many slots are filled together on one slide. */
export const MAX_PER_SLIDE = 3;
