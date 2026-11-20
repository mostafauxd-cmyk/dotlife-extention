import { lang } from "./i18n";
import { PERSONAS } from "./personas";
import { DEFAULT_SITES, type QuickFolder, type QuickSite } from "./settings";

/**
 * The quick-access row in English (2026-11-20, the user: «اسم بوکمارک هامونم توی نسخه انگلیسی
 * انگلیسی باشن»). The tiles and folders are the person's own, kept as they were made, so nothing
 * stored is changed: only a site or folder that still has the name it was given by the extension
 * (a default site, a persona's folder and its sites) is shown by its English name. One the person
 * renamed shows as they wrote it.
 */
const SITE_EN: Readonly<Record<string, string>> = {
  یوتیوب: "YouTube",
  جیمیل: "Gmail",
  دیجی‌کالا: "Digikala",
  آپارات: "Aparat",
  "گوگل درایو": "Google Drive",
  ویکی‌پدیا: "Wikipedia",
  فیگما: "Figma",
  دریبل: "Dribbble",
  بیهنس: "Behance",
  "فونت‌های فارسی": "Persian fonts",
  لیارا: "Liara",
  آروان: "ArvanCloud",
  "سامانه‌ی مودیان": "Moadian tax portal",
  "امور مالیاتی": "Tax affairs",
  "تأمین اجتماعی": "Social security",
  کدال: "Codal",
  "نرخ ارز": "Exchange rates",
  "گوگل اسکالر": "Google Scholar",
  ایرانداک: "IranDoc",
  فرادرس: "Faradars",
  مترجم: "Translate",
  باسلام: "Basalam",
  "دیجی‌کالا سلر": "Digikala Seller",
  ترب: "Torob",
  تیپاکس: "Tipax",
  زرین‌پال: "Zarinpal",
  اینستاگرام: "Instagram",
  "تقویم گوگل": "Google Calendar",
  اسکای‌روم: "Skyroom",
  بله: "Bale",
};

const FOLDER_EN: Readonly<Record<string, string>> = {
  طراحی: "Design",
  برنامه‌نویسی: "Programming",
  حسابداری: "Accounting",
  دانشگاه: "University",
  فروش: "Selling",
  کار: "Work",
};

/** Each site the extension itself puts in the row, by address: the name it was given. */
const BUILT_IN = new Map<string, string>(
  [...DEFAULT_SITES, ...PERSONAS.flatMap((p) => p.sites)].map((s) => [s.url, s.title]),
);

/** A tile's name as shown: English for a built-in site still named as it came, in English. */
export function siteLabel(site: QuickSite): string {
  if (lang() !== "en") return site.title;
  const given = BUILT_IN.get(site.url);
  return given === site.title ? (SITE_EN[site.title] ?? site.title) : site.title;
}

/** A folder's name as shown: English for a persona's folder still named as it came, in English. */
export function folderLabel(folder: QuickFolder): string {
  if (lang() !== "en" || folder.persona === undefined) return folder.name;
  const given = PERSONAS.find((p) => p.id === folder.persona)?.folder;
  return given === folder.name ? (FOLDER_EN[folder.name] ?? folder.name) : folder.name;
}
