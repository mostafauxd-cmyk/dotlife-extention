/**
 * Cities of Iran the user can pick by hand (step 13, 2026-10-08): every provincial capital and the
 * larger towns, with the coordinates of the town centre. A hundredth of a degree is about a kilometre,
 * a few seconds of prayer time, so two decimals are plenty. All of them keep Tehran's clock. Tehran,
 * Mashhad, Tabriz, Bandar Abbas and Zahedan are the points `prayer-times` matches to time.ir.
 */
export type City = {
  /** Stable, never reused: it is what the phone remembers. */
  id: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
};

const c = (
  id: string,
  name: string,
  province: string,
  latitude: number,
  longitude: number,
): City => ({ id, name, province, latitude, longitude });

export const CITIES: readonly City[] = [
  // the provincial capitals
  c("tehran", "تهران", "تهران", 35.6892, 51.389),
  c("mashhad", "مشهد", "خراسان رضوی", 36.2605, 59.6168),
  c("isfahan", "اصفهان", "اصفهان", 32.6539, 51.666),
  c("karaj", "کرج", "البرز", 35.8327, 50.9915),
  c("shiraz", "شیراز", "فارس", 29.5918, 52.5837),
  c("tabriz", "تبریز", "آذربایجان شرقی", 38.08, 46.2919),
  c("qom", "قم", "قم", 34.6399, 50.8759),
  c("ahvaz", "اهواز", "خوزستان", 31.3183, 48.6706),
  c("kermanshah", "کرمانشاه", "کرمانشاه", 34.3142, 47.065),
  c("urmia", "ارومیه", "آذربایجان غربی", 37.5527, 45.0761),
  c("rasht", "رشت", "گیلان", 37.2808, 49.5832),
  c("zahedan", "زاهدان", "سیستان و بلوچستان", 29.4963, 60.8629),
  c("hamedan", "همدان", "همدان", 34.7983, 48.5148),
  c("kerman", "کرمان", "کرمان", 30.2839, 57.0834),
  c("yazd", "یزد", "یزد", 31.8974, 54.3569),
  c("ardabil", "اردبیل", "اردبیل", 38.2498, 48.2933),
  c("bandar-abbas", "بندرعباس", "هرمزگان", 27.1865, 56.2808),
  c("arak", "اراک", "مرکزی", 34.0917, 49.6892),
  c("zanjan", "زنجان", "زنجان", 36.6736, 48.4787),
  c("sanandaj", "سنندج", "کردستان", 35.3219, 46.9862),
  c("qazvin", "قزوین", "قزوین", 36.2797, 50.0049),
  c("khorramabad", "خرم‌آباد", "لرستان", 33.4878, 48.3558),
  c("gorgan", "گرگان", "گلستان", 36.8456, 54.4393),
  c("sari", "ساری", "مازندران", 36.5633, 53.0601),
  c("bojnurd", "بجنورد", "خراسان شمالی", 37.4747, 57.329),
  c("birjand", "بیرجند", "خراسان جنوبی", 32.8663, 59.2211),
  c("bushehr", "بوشهر", "بوشهر", 28.9234, 50.8203),
  c("ilam", "ایلام", "ایلام", 33.6374, 46.4227),
  c("shahrekord", "شهرکرد", "چهارمحال و بختیاری", 32.3256, 50.8644),
  c("yasuj", "یاسوج", "کهگیلویه و بویراحمد", 30.6682, 51.588),
  c("semnan", "سمنان", "سمنان", 35.5729, 53.3971),
  // larger towns
  c("eslamshahr", "اسلامشهر", "تهران", 35.5523, 51.235),
  c("varamin", "ورامین", "تهران", 35.3242, 51.6457),
  c("kashan", "کاشان", "اصفهان", 33.985, 51.41),
  c("najafabad", "نجف‌آباد", "اصفهان", 32.6342, 51.3668),
  c("neyshabur", "نیشابور", "خراسان رضوی", 36.2133, 58.7958),
  c("sabzevar", "سبزوار", "خراسان رضوی", 36.2126, 57.6819),
  c("torbat-heydarieh", "تربت حیدریه", "خراسان رضوی", 35.274, 59.2195),
  c("quchan", "قوچان", "خراسان رضوی", 37.106, 58.51),
  c("marvdasht", "مرودشت", "فارس", 29.8742, 52.8025),
  c("kazerun", "کازرون", "فارس", 29.6195, 51.6541),
  c("jahrom", "جهرم", "فارس", 28.5, 53.5605),
  c("fasa", "فسا", "فارس", 28.9383, 53.6482),
  c("maragheh", "مراغه", "آذربایجان شرقی", 37.3917, 46.2398),
  c("marand", "مرند", "آذربایجان شرقی", 38.4329, 45.7749),
  c("khoy", "خوی", "آذربایجان غربی", 38.5503, 44.9521),
  c("mahabad", "مهاباد", "آذربایجان غربی", 36.7631, 45.7222),
  c("miandoab", "میاندوآب", "آذربایجان غربی", 36.9694, 46.1027),
  c("dezful", "دزفول", "خوزستان", 32.383, 48.4),
  c("abadan", "آبادان", "خوزستان", 30.3392, 48.3043),
  c("khorramshahr", "خرمشهر", "خوزستان", 30.4397, 48.1664),
  c("andimeshk", "اندیمشک", "خوزستان", 32.46, 48.3592),
  c("shushtar", "شوشتر", "خوزستان", 32.0456, 48.8569),
  c("behbahan", "بهبهان", "خوزستان", 30.5959, 50.2417),
  c("mahshahr", "ماهشهر", "خوزستان", 30.5589, 49.1981),
  c("borujerd", "بروجرد", "لرستان", 33.8973, 48.7516),
  c("malayer", "ملایر", "همدان", 34.2969, 48.8235),
  c("saveh", "ساوه", "مرکزی", 35.0213, 50.3566),
  c("saqqez", "سقز", "کردستان", 36.2499, 46.2735),
  c("lahijan", "لاهیجان", "گیلان", 37.2072, 50.0039),
  c("bandar-anzali", "بندر انزلی", "گیلان", 37.4727, 49.4623),
  c("babol", "بابل", "مازندران", 36.5513, 52.679),
  c("amol", "آمل", "مازندران", 36.4696, 52.3507),
  c("qaemshahr", "قائم‌شهر", "مازندران", 36.4631, 52.8601),
  c("chalus", "چالوس", "مازندران", 36.655, 51.42),
  c("ramsar", "رامسر", "مازندران", 36.9031, 50.6583),
  c("gonbad-kavus", "گنبد کاووس", "گلستان", 37.25, 55.1672),
  c("shahrud", "شاهرود", "سمنان", 36.4182, 54.9763),
  c("rafsanjan", "رفسنجان", "کرمان", 30.4067, 55.9939),
  c("sirjan", "سیرجان", "کرمان", 29.452, 55.6814),
  c("bam", "بم", "کرمان", 29.106, 58.357),
  c("zabol", "زابل", "سیستان و بلوچستان", 31.0287, 61.5012),
  c("chabahar", "چابهار", "سیستان و بلوچستان", 25.2919, 60.643),
  c("kish", "کیش", "هرمزگان", 26.5578, 53.98),
  c("qeshm", "قشم", "هرمزگان", 26.9581, 56.2719),
];

export const DEFAULT_CITY_ID = "tehran";

export const cityById = (id: string): City | undefined => CITIES.find((x) => x.id === id);

/** Persian keyboards differ: ي/ی, ك/ک, half-spaces and spaces all count as the same. */
const normalize = (s: string): string =>
  s
    .trim()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[آأإ]/g, "ا")
    .replace(/[‌\s]+/g, "");

/**
 * The exact name first («کرمان» before «کرمانشاه»), then names that start with the query, then those
 * that contain it, then the towns of a matching province.
 */
export function searchCities(query: string): City[] {
  const q = normalize(query);
  if (q === "") return [...CITIES];
  const exact = CITIES.filter((x) => normalize(x.name) === q);
  const starts = [
    ...exact,
    ...CITIES.filter((x) => !exact.includes(x) && normalize(x.name).startsWith(q)),
  ];
  const contains = CITIES.filter((x) => !starts.includes(x) && normalize(x.name).includes(q));
  const province = CITIES.filter(
    (x) => !starts.includes(x) && !contains.includes(x) && normalize(x.province).includes(q),
  );
  return [...starts, ...contains, ...province];
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The nearest city in the list, and how far it is. */
export function nearestCity(latitude: number, longitude: number): { city: City; km: number } {
  let best = CITIES[0] as City;
  let km = Number.POSITIVE_INFINITY;
  for (const x of CITIES) {
    const d = distanceKm(latitude, longitude, x.latitude, x.longitude);
    if (d < km) {
      best = x;
      km = d;
    }
  }
  return { city: best, km };
}
