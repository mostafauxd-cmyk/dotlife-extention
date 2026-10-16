import { isObject, text } from "./fields";

/**
 * A promotional notice (2026-10-14, the user: «پنل… هم برای مدیریت اعلان»): written in the panel,
 * handed out with the app's settings, and shown by the phone itself at its time — no push from the
 * server, so a million phones cost nothing and no push service is needed in Iran. A phone that has
 * not opened the app since the notice was written does not get it; one past its time drops it.
 *
 * They go in their own Android channel («پیشنهادها و خبرها»): turning them off never touches the
 * adhan or the reminders. The phone also keeps them rare on its own (`planNotices`).
 */

/** Who a notice is for, from what the phone knows of its person («درباره‌ی شما»). */
export const NOTICE_AGES = ["all", "under35", "over35"] as const;
export type NoticeAge = (typeof NOTICE_AGES)[number];
export const NOTICE_GENDERS = ["all", "female", "male"] as const;
export type NoticeGender = (typeof NOTICE_GENDERS)[number];

export type Notice = {
  /** The notice's name: one notification per name, ever, on a phone. */
  id: string;
  /** Always true once read (the server sends what it read; the phone reads it again). */
  on: true;
  /** When, on the phone's own clock: `2026-12-20T19:00` is seven in the evening wherever it is. */
  at: string;
  title: string;
  text: string | null;
  /** Opened by a tap: a page of the app (`dotlife://…`) or `https://…`; null = the app. */
  link: string | null;
  age: NoticeAge;
  gender: NoticeGender;
};

export const MAX_NOTICES = 20;
/** The phone shows at most this many in any 30 days, and never two on one day. */
export const NOTICES_PER_30_DAYS = 3;

const ID = /^[a-z0-9][a-z0-9._-]{0,60}$/;
const AT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LINK = /^(https:\/\/\S+|dotlife:\/\/\S*)$/;

/** A wall-clock time on the phone, as a moment; NaN for a bad one. */
export function noticeTime(at: string): number {
  const m = AT.exec(at);
  if (m === null) return Number.NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return Number.NaN;
  return new Date(y, mo - 1, d, h, mi).getTime();
}

/** One notice, or null when it cannot be shown as written or is not on. */
export function parseNotice(input: unknown): Notice | null {
  if (!isObject(input) || input.on !== true) return null;
  const title = text(input.title, 60);
  if (typeof input.id !== "string" || !ID.test(input.id) || title === null) return null;
  if (typeof input.at !== "string" || Number.isNaN(noticeTime(input.at))) return null;
  return {
    id: input.id,
    on: true,
    at: input.at,
    title,
    text: text(input.text, 160),
    link: typeof input.link === "string" && LINK.test(input.link) ? input.link : null,
    age: NOTICE_AGES.find((a) => a === input.age) ?? "all",
    gender: NOTICE_GENDERS.find((g) => g === input.gender) ?? "all",
  };
}

export function parseNotices(input: unknown): readonly Notice[] {
  if (!Array.isArray(input)) return [];
  const out: Notice[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const n = parseNotice(raw);
    if (n === null || seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
    if (out.length === MAX_NOTICES) break;
  }
  return out;
}

/** What the phone knows of its person; unknown matches only «همه». */
export type NoticeReader = { age: number | null; gender: "female" | "male" | null };

export function noticeFor(n: Notice, who: NoticeReader): boolean {
  if (n.age !== "all") {
    if (who.age === null) return false;
    if (n.age === "under35" ? who.age >= 35 : who.age < 35) return false;
  }
  return n.gender === "all" || n.gender === who.gender;
}

const DAY = 86_400_000;
const dayOf = (t: number): string => {
  const d = new Date(t);
  return `${String(d.getFullYear())}-${String(d.getMonth())}-${String(d.getDate())}`;
};

/**
 * The notices this phone arms now: for its person, still ahead (within `horizon`), not shown before
 * (`shown`, with when), and rare — never two on one day, at most `NOTICES_PER_30_DAYS` in any 30
 * days counting the ones already shown. Earlier ones win.
 */
export function planNotices(
  notices: readonly Notice[],
  now: number,
  who: NoticeReader,
  shown: Readonly<Record<string, number>>,
  horizon = 30 * DAY,
): { notice: Notice; time: number }[] {
  const taken = Object.values(shown);
  const plan: { notice: Notice; time: number }[] = [];
  const ahead = notices
    .filter((n) => !(n.id in shown) && noticeFor(n, who))
    .map((n) => ({ notice: n, time: noticeTime(n.at) }))
    .filter((p) => p.time > now && p.time <= now + horizon)
    .sort((a, b) => a.time - b.time);
  for (const p of ahead) {
    const all = [...taken, ...plan.map((q) => q.time)];
    if (all.some((t) => dayOf(t) === dayOf(p.time))) continue;
    if (all.filter((t) => Math.abs(t - p.time) < 30 * DAY).length >= NOTICES_PER_30_DAYS) continue;
    plan.push(p);
  }
  return plan;
}
