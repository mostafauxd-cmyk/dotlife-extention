import type { Ad } from "@dotlife/ads";

import { graphemes } from "./labels";
import { PROMO_LOOK_LABEL } from "./slotForm";

/**
 * Noghte's app draws its sponsor cards from its own `promo` list (Dotlife repo,
 * packages/shared/src/promo.ts), written through its admin route `PUT /admin/api/promos/:id`. Until
 * the app reads NX Ads' bundle, the ads of places 101 and 102 are turned into those writes here, in
 * the shape that route reads. A place shows the first live card in the list, so the biggest share
 * goes first.
 */

export type PromoCard = {
  from: string | null;
  until: string | null;
  place: "top" | "end";
  look: "compact" | "picture";
  title: string;
  text: string | null;
  label: string | null;
  image: { url: string; width: number; height: number } | null;
  action: { title: string; url: string } | null;
  tint: string | null;
  closable: boolean;
};

/** The body of one `PUT /admin/api/promos/:id`, with the id it goes to. */
export type PromoWrite = { id: string; slot: "calendar"; on: true; card: PromoCard };

const PLACE: Record<number, PromoCard["place"]> = { 101: "top", 102: "end" };

const cut = (s: string | undefined, max: number): string | null => {
  if (s === undefined) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t === "" ? null : graphemes(t).slice(0, max).join("");
};

/** The app's card names: lower-case letters, digits, «.», «_» and «-», at most 61. */
export const promoId = (adId: string): string =>
  `nx-${adId}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .slice(0, 61);

const side = (v: string | undefined): number | undefined => {
  const n = Number(v);
  return v !== undefined && Number.isInteger(n) && n > 0 && n <= 4096 ? n : undefined;
};

export function toNoghtePromos(ads: readonly Ad[]): PromoWrite[] {
  return ads
    .filter((a) => a.products.includes("noghte") && PLACE[a.slot] !== undefined)
    .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || b.weight - a.weight)
    .map((a) => {
      const width = side(a.extra?.["imageWidth"]);
      const height = side(a.extra?.["imageHeight"]);
      const image =
        a.image !== undefined && width !== undefined && height !== undefined
          ? { url: a.image, width, height }
          : null;
      const cta = cut(a.cta, 24);
      return {
        id: promoId(a.id),
        slot: "calendar",
        on: true,
        card: {
          from: a.from ?? null,
          until: a.until ?? null,
          place: PLACE[a.slot] ?? "top",
          look:
            a.extra?.["look"] === PROMO_LOOK_LABEL.picture && image !== null
              ? "picture"
              : "compact",
          title: cut(a.title, 60) ?? a.title,
          text: cut(a.line, 160),
          label: cut(a.extra?.["label"] ?? `با همراهی ${a.advertiser}`, 40),
          image,
          action: cta === null ? null : { title: cta, url: a.url },
          tint: a.tint ?? null,
          closable: true,
        },
      };
    });
}
