/**
 * The words an ad is aimed by. A client must send the same ids in `AdContext`, and the admin panel
 * offers only these for the closed sets (persona, season); city, occasion, topic and keyword are
 * open, with suggestions.
 */

/** The new tab's personas (apps/newtab/src/personas.ts), with the quick-access folder each gets. */
export const AD_PERSONAS = [
  { id: "designer", name: "طراح", folder: "طراحی" },
  { id: "dev", name: "برنامه‌نویس", folder: "برنامه‌نویسی" },
  { id: "acc", name: "حسابدار", folder: "حسابداری" },
  { id: "student", name: "دانشجو", folder: "دانشگاه" },
  { id: "seller", name: "فروشنده‌ی آنلاین", folder: "فروش" },
  { id: "manager", name: "مدیر و کارمند", folder: "کار" },
] as const;

export const AD_SEASONS = [
  { id: "spring", name: "بهار" },
  { id: "summer", name: "تابستان" },
  { id: "autumn", name: "پاییز" },
  { id: "winter", name: "زمستان" },
] as const;


/**
 * The cities a person may choose (the new tab's CityPicker, apps/newtab/src/cities.ts, keeps the
 * same list; a test there checks they agree). Ads match a city by this name.
 */
const CITY_LIST = `
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

const CITY_SPACED: Record<string, string> = {
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

export const AD_CITIES: readonly string[] = [
  ...new Set(
    CITY_LIST.split(/\s+/)
      .filter((w) => w !== "")
      .map((w) => CITY_SPACED[w] ?? w),
  ),
];

/** What a person may say they follow (the new tab's INTERESTS); also what a feed card is aimed at. */
export const AD_TOPICS: readonly string[] = [
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
