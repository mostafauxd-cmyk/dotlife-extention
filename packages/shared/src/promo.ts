import { isObject, parseImage, text, type SizedImage } from "./fields";

/**
 * A sponsor's card (2026-10-14, the user: «جا برای تبلیغ… کارت و باکسش جوری باشه حس تبلیغ بیرونی
 * نده، ما خودمون برای مشتری‌ها کاستوم کنیم… از سرور روشن و خاموش بشه»): written per customer in the
 * server's settings file and drawn by the app as one of its own boxes — its fonts, its glass, its
 * buttons — never an ad network's banner. Nothing shows unless the file lists a card with `"on": true`.
 *
 * Several cards may wait in the list (Yalda's, Nowruz's…): a phone shows the first one that is on,
 * inside its dates, and not closed on that phone.
 */

/** The places in the app that can hold a card. */
export const PROMO_SLOTS = ["calendar"] as const;
export type PromoSlot = (typeof PROMO_SLOTS)[number];

/** On the calendar page: above the day's boxes, or after them. */
export const PROMO_PLACES = ["top", "end"] as const;
export type PromoPlace = (typeof PROMO_PLACES)[number];

/**
 * How the card is drawn: `compact` — the words first, a small picture beside them; `picture` — the
 * picture fills the box and a few words sit on a dark gradient over its foot (the user, 2026-10-14:
 * «ورژن عکس‌بیس… عکس مهم‌تر باشه»). A `picture` card without a picture is drawn compact.
 */
export const PROMO_LOOKS = ["compact", "picture"] as const;
export type PromoLook = (typeof PROMO_LOOKS)[number];

export type PromoAction = {
  /** The button's words: «مشاهده»، «دریافت کد تخفیف»… */
  title: string;
  /** `https://…`, a store page (`bazaar:`/`myket:`), or a page of the app (`dotlife://…`). */
  url: string;
};

export type Promo = {
  /** The card's name; closing it on a phone puts away this one only. */
  id: string;
  /**
   * Always true once read: the server sends what it read and the phone reads it again, so a card
   * must read the same twice (2026-10-14: without this the phone saw every card as off).
   */
  on: true;
  /** Shown from this moment (`2026-12-18` = that day's start on the phone; or a full ISO time). */
  from: string | null;
  /** Shown until this moment (`2026-12-21` = to the end of that day; or a full ISO time). */
  until: string | null;
  place: PromoPlace;
  look: PromoLook;
  title: string;
  text: string | null;
  /** A quiet line at the card's foot, for who it is with: «با همراهی …». */
  label: string | null;
  /** The customer's picture, made by us for them: beside the words, or the whole card (`look`). */
  image: SizedImage | null;
  action: PromoAction | null;
  /** The button's colour (`#RRGGBB`), the customer's own; null = the app's. */
  tint: string | null;
  /** Whether the card has «بستن». */
  closable: boolean;
};

export type Promos = Readonly<Record<PromoSlot, readonly Promo[]>>;

export const NO_PROMOS: Promos = { calendar: [] };

/** At most this many cards wait per place. */
export const MAX_PROMOS = 10;

const ID = /^[a-z0-9][a-z0-9._-]{0,60}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

const isMoment = (v: unknown): v is string =>
  typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));

const isActionUrl = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 500 &&
  /^(https:\/\/[^\s]+|bazaar:\/\/\S+|myket:\/\/\S+|dotlife:\/\/\S*)$/.test(v);

function parseAction(input: unknown): PromoAction | null {
  if (!isObject(input)) return null;
  const title = text(input.title, 24);
  return title !== null && isActionUrl(input.url) ? { title, url: input.url } : null;
}

/** One card, or null when it cannot be shown as written (no name or no title) or is not on. */
export function parsePromo(input: unknown): Promo | null {
  if (!isObject(input)) return null;
  // off unless said: a card half-written in the file never reaches a phone by mistake
  if (input.on !== true) return null;
  const title = text(input.title, 60);
  if (typeof input.id !== "string" || !ID.test(input.id) || title === null) return null;
  return {
    id: input.id,
    on: true,
    from: isMoment(input.from) ? input.from : null,
    until: isMoment(input.until) ? input.until : null,
    place: PROMO_PLACES.find((p) => p === input.place) ?? "top",
    look: PROMO_LOOKS.find((l) => l === input.look) ?? "compact",
    title,
    text: text(input.text, 160),
    label: text(input.label, 40),
    image: parseImage(input.image),
    action: parseAction(input.action),
    tint: typeof input.tint === "string" && HEX.test(input.tint) ? input.tint : null,
    closable: input.closable !== false,
  };
}

/** Every place's cards, one by one: a broken card is left out, the rest stand. */
export function parsePromos(input: unknown): Promos {
  if (!isObject(input)) return NO_PROMOS;
  const out: Record<PromoSlot, Promo[]> = { calendar: [] };
  for (const slot of PROMO_SLOTS) {
    const list = input[slot];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    for (const raw of list) {
      const p = parsePromo(raw);
      if (p === null || seen.has(p.id)) continue;
      seen.add(p.id);
      out[slot].push(p);
      if (out[slot].length === MAX_PROMOS) break;
    }
  }
  return out;
}

/** A moment as a time: a bare day is that day on the phone's clock — its start, or its end. */
function timeOf(moment: string, end: boolean): number {
  if (!DAY.test(moment)) return Date.parse(moment);
  const [y, m, d] = moment.split("-").map(Number) as [number, number, number];
  return end ? new Date(y, m - 1, d + 1).getTime() - 1 : new Date(y, m - 1, d).getTime();
}

/** Whether a card is inside its dates now. */
export function promoLive(p: Promo, now: Date): boolean {
  const t = now.getTime();
  if (p.from !== null && t < timeOf(p.from, false)) return false;
  if (p.until !== null && t > timeOf(p.until, true)) return false;
  return true;
}

/** The card a place shows now: the first live one not closed on this phone; null = none. */
export function promoFor(
  list: readonly Promo[],
  now: Date,
  closed: ReadonlySet<string>,
): Promo | null {
  return list.find((p) => !closed.has(p.id) && promoLive(p, now)) ?? null;
}
