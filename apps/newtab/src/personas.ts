import { isFolder, settings, updateSettings, type QuickFolder, type QuickSite } from "./settings";

/**
 * «کدام بیشتر شبیه توست؟» — asked once in the welcome, changeable in «شخصی‌سازی». The answer adds a
 * folder of that work's sites to the quick-access row (the design's personas and their sites).
 */

export type Persona = {
  id: string;
  name: string;
  hint: string;
  folder: string;
  sites: QuickSite[];
};

export const PERSONAS: readonly Persona[] = [
  {
    id: "designer",
    name: "طراح",
    hint: "فیگما، دریبل، فونت‌ها",
    folder: "طراحی",
    sites: [
      { title: "فیگما", url: "https://www.figma.com/" },
      { title: "Mobbin", url: "https://mobbin.com/" },
      { title: "دریبل", url: "https://dribbble.com/" },
      { title: "بیهنس", url: "https://www.behance.net/" },
      { title: "Coolors", url: "https://coolors.co/" },
      { title: "فونت‌های فارسی", url: "https://fontiran.com/" },
    ],
  },
  {
    id: "dev",
    name: "برنامه‌نویس",
    hint: "گیت‌هاب، MDN، لیارا",
    folder: "برنامه‌نویسی",
    sites: [
      { title: "GitHub", url: "https://github.com/" },
      { title: "Stack Overflow", url: "https://stackoverflow.com/" },
      { title: "MDN", url: "https://developer.mozilla.org/" },
      { title: "لیارا", url: "https://console.liara.ir/" },
      { title: "آروان", url: "https://panel.arvancloud.ir/" },
      { title: "npm", url: "https://www.npmjs.com/" },
    ],
  },
  {
    id: "acc",
    name: "حسابدار",
    hint: "مودیان، تأمین اجتماعی، کدال",
    folder: "حسابداری",
    sites: [
      { title: "سامانه‌ی مودیان", url: "https://my.tax.gov.ir/" },
      { title: "امور مالیاتی", url: "https://www.intamedia.ir/" },
      { title: "تأمین اجتماعی", url: "https://es.tamin.ir/" },
      { title: "کدال", url: "https://www.codal.ir/" },
      { title: "TSETMC", url: "https://www.tsetmc.com/" },
      { title: "نرخ ارز", url: "https://www.tgju.org/" },
    ],
  },
  {
    id: "student",
    name: "دانشجو",
    hint: "اسکالر، ایرانداک، فرادرس",
    folder: "دانشگاه",
    sites: [
      { title: "گوگل اسکالر", url: "https://scholar.google.com/" },
      { title: "ایرانداک", url: "https://ganj.irandoc.ac.ir/" },
      { title: "Coursera", url: "https://www.coursera.org/" },
      { title: "فرادرس", url: "https://faradars.org/" },
      { title: "مترجم", url: "https://translate.google.com/" },
      { title: "ویکی‌پدیا", url: "https://fa.wikipedia.org/" },
    ],
  },
  {
    id: "seller",
    name: "فروشنده‌ی آنلاین",
    hint: "باسلام، ترب، تیپاکس",
    folder: "فروش",
    sites: [
      { title: "باسلام", url: "https://basalam.com/" },
      { title: "دیجی‌کالا سلر", url: "https://seller.digikala.com/" },
      { title: "ترب", url: "https://torob.com/" },
      { title: "تیپاکس", url: "https://tipaxco.com/" },
      { title: "زرین‌پال", url: "https://www.zarinpal.com/" },
      { title: "اینستاگرام", url: "https://www.instagram.com/" },
    ],
  },
  {
    id: "manager",
    name: "مدیر و کارمند",
    hint: "جیمیل، تقویم، اسکای‌روم",
    folder: "کار",
    sites: [
      { title: "جیمیل", url: "https://mail.google.com/" },
      { title: "تقویم گوگل", url: "https://calendar.google.com/" },
      { title: "اسکای‌روم", url: "https://www.skyroom.online/" },
      { title: "Jira", url: "https://www.atlassian.com/software/jira" },
      { title: "گوگل درایو", url: "https://drive.google.com/" },
      { title: "بله", url: "https://web.bale.ai/" },
    ],
  },
];

export const personaById = (id: string | null): Persona | undefined =>
  PERSONAS.find((p) => p.id === id);

/**
 * Picks a persona: its folder of sites joins the end of the row (the previous persona's folder goes,
 * the person's own tiles and folders stay). Null takes the persona folder away.
 */
export function applyPersona(id: string | null): void {
  const s = settings();
  const kept = s.sites.filter((i) => !(isFolder(i) && i.persona !== undefined));
  const p = personaById(id);
  const folder: QuickFolder[] =
    p === undefined
      ? []
      : [
          {
            kind: "folder",
            id: `persona-${p.id}`,
            name: p.folder,
            items: [...p.sites],
            persona: p.id,
          },
        ];
  updateSettings({ persona: id, sites: [...kept, ...folder] });
}
