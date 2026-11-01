/**
 * Paket's built-in categories as the app shows them. The snapshot sends a category's stored name,
 * which for the built-in ones is the English `displayName` of Paket's seed
 * (packages/database/src/seeds/systemCategories.ts); the app shows its own Persian label
 * (apps/mobile/src/data/categories.ts) and its art, keyed by the seed's `code`. The art is copied
 * into public/category: `<code>.jpg` the round picture, `<code>.svg` the glyph drawn white on it.
 * A category the person made has their own name and no art here: it keeps its name and a dot.
 */
const BUILT_IN: Record<string, [code: string, fa: string]> = {
  Salary: ["salary", "حقوق"],
  Freelance: ["freelance", "پروژه"],
  "Sales & Commission": ["sales_commission", "فروش و کمیسیون"],
  Rent: ["rent_income", "درآمد اجاره"],
  Yield: ["yield", "سود سرمایه"],
  "Business Profit": ["business_profit", "سود کسب‌وکار"],
  Coffee: ["coffee", "قهوه"],
  Groceries: ["groceries", "خرید روزمره"],
  Restaurant: ["restaurant", "رستوران"],
  Transport: ["transport", "حمل‌ونقل"],
  Car: ["car", "ماشین"],
  Home: ["home", "خانه"],
  Bills: ["bills", "قبوض"],
  Clothing: ["clothing", "پوشاک"],
  Electronics: ["electronics", "الکترونیک"],
  Shopping: ["shopping", "خرید"],
  Health: ["health", "سلامت"],
  Beauty: ["beauty", "زیبایی"],
  Fitness: ["fitness", "ورزش"],
  Fun: ["fun", "تفریح"],
  Subscriptions: ["subscriptions", "اشتراک"],
  Travel: ["travel", "سفر"],
  Education: ["education", "آموزش"],
  Gifts: ["gifts", "هدیه"],
  Charity: ["charity", "خیریه"],
  Pet: ["pet", "حیوان خونگی"],
  Loans: ["loans", "اقساط"],
  Fees: ["fees", "کارمزد"],
  Savings: ["savings", "پس‌انداز"],
  Invest: ["invest", "سرمایه‌گذاری"],
  Transfer: ["transfer", "جیب‌به‌جیب"],
  Cash: ["cash", "نقد"],
  Lending: ["lending", "قرض"],
  Miscellaneous: ["misc", "متفرقه"],
};

/**
 * Every face Paket draws a category with, the built-ins' and the spares «انتخاب ایکون» offers for a
 * category the person makes — the files in public/category.
 */
const ART = new Set([
  ...Object.values(BUILT_IN).map(([code]) => code),
  ...[
    "ai_chip antenna basketball bicycle book building_office bus_front car_crash car_engine church",
    "coffee_beans dress engine_oil flight_ticket fruits gas_station gift_card grave hat helmet",
    "hospital laptop metro mobile_bank music_ticket olives pen pet_pharmacy pet_shop pineapple",
    "pistachios pumpkin shop_discount shopping_bag subway ticket underwear vegetables video_stand",
    "visa_card vpn weights",
  ]
    .join(" ")
    .split(" "),
]);

/**
 * A category's name in Persian, and the key of its art. A newer Paket sends the name the phone
 * shows and the art's key (`icon`: a built-in's code, or the face the person picked for one of
 * their own); an older one only the built-in's English name.
 */
export function paketCategory(
  name: string,
  icon?: string | null,
): { name: string; art: string | null } {
  const hit = BUILT_IN[name.trim()];
  const art = icon !== undefined && icon !== null && ART.has(icon) ? icon : (hit?.[0] ?? null);
  return { name: hit?.[1] ?? name, art };
}
