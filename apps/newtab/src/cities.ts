/**
 * The cities a person can pick as theirs (only to be offered nearer «معرفی‌شده» boxes): every
 * province's capital and the cities a partner is likely to name — events, delivery, travel. Any other
 * name can still be typed. Ads match a city by this name.
 */

const LIST = `
تهران مشهد اصفهان شیراز تبریز کرج اهواز قم رشت ارومیه کرمان همدان اراک یزد اردبیل بندرعباس زنجان
سنندج قزوین خرم‌آباد گرگان ساری بجنورد بیرجند بوشهر ایلام شهرکرد سمنان زاهدان یاسوج کرمانشاه
کیش قشم چابهار آبادان خرمشهر دزفول ماهشهر بهبهان شوشتر اندیمشک رامهرمز ایذه مسجدسلیمان
رفسنجان سیرجان بم جیرفت زرند ورامین شهریار اسلامشهر قدس ملارد پاکدشت نظرآباد فردیس گرمسار دماوند
پردیس رباط‌کریم بومهن نجف‌آباد کاشان خمینی‌شهر شاهین‌شهر فولادشهر آران‌وبیدگل مبارکه نطنز گلپایگان
خوانسار فلاورجان زرین‌شهر سمیرم کاشمر نیشابور سبزوار تربت‌حیدریه تربت‌جام قوچان تایباد سرخس چناران
مراغه مرند میانه اهر خوی سلماس میاندوآب بوکان مهاباد پیرانشهر سقز بانه مریوان کامیاران قروه
اسلام‌آبادغرب سرپل‌ذهاب جوانرود ملایر نهاوند تویسرکان اسدآباد بروجرد دورود الیگودرز ساوه خمین
محلات دلیجان آمل بابل قائم‌شهر تنکابن چالوس نوشهر رامسر بابلسر جویبار لاهیجان لنگرود بندرانزلی
آستارا رودسر صومعه‌سرا فومن تالش گنبدکاووس علی‌آباد‌کتول بندرترکمن آزادشهر مینودشت لار جهرم
مرودشت کازرون فسا داراب آباده لامرد گناوه کنگان عسلویه بندرلنگه میناب ایرانشهر سراوان خاش زابل
قائن طبس اردکان میبد ابرکوه بافق دامغان شاهرود میامی مشگین‌شهر خلخال پارس‌آباد بیلارسوار
`;

/** Names with a space in them (the list above joins them with a half-space or none). */
const SPACED: Record<string, string> = {
  آران‌وبیدگل: "آران و بیدگل",
  اسلام‌آبادغرب: "اسلام‌آباد غرب",
  سرپل‌ذهاب: "سرپل ذهاب",
  علی‌آباد‌کتول: "علی‌آباد کتول",
  بندرانزلی: "بندر انزلی",
  بندرترکمن: "بندر ترکمن",
  بندرلنگه: "بندر لنگه",
  بندرعباس: "بندر عباس",
  گنبدکاووس: "گنبد کاووس",
  تربت‌حیدریه: "تربت حیدریه",
  تربت‌جام: "تربت جام",
  رباط‌کریم: "رباط کریم",
};

export const CITIES: readonly string[] = [
  ...new Set(
    LIST.split(/\s+/)
      .filter((w) => w !== "")
      .map((w) => SPACED[w] ?? w),
  ),
];

/** The first row of quick picks. */
export const POPULAR_CITIES: readonly string[] = [
  "تهران",
  "مشهد",
  "اصفهان",
  "شیراز",
  "تبریز",
  "کرج",
  "اهواز",
  "قم",
];

/** For matching what is typed: Arabic letters made Persian, joiners and spaces dropped. */
export const flat = (s: string): string =>
  s.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[‌\s]/g, "").toLowerCase();

/** The cities that fit what was typed: those that start with it first, then those that contain it. */
export function findCities(q: string, limit = 8): string[] {
  const k = flat(q);
  if (k === "") return [];
  const starts = CITIES.filter((c) => flat(c).startsWith(k));
  const has = CITIES.filter((c) => !flat(c).startsWith(k) && flat(c).includes(k));
  return [...starts, ...has].slice(0, limit);
}

/** What a person may say they follow (also what a «کارت فید» ad is aimed at). */
export const INTERESTS: readonly string[] = [
  "سفر",
  "اقتصاد",
  "فناوری",
  "ورزش",
  "فرهنگ",
  "سلامت",
  "خودرو",
  "غذا",
  "کتاب",
  "موسیقی",
  "سینما",
  "بازی",
  "آموزش",
  "مد و پوشاک",
  "خانه و دکور",
  "املاک",
  "کسب‌وکار",
  "هنر",
];
