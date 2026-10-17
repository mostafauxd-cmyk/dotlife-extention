import { call } from "./auth";
import type { PromoCard, PromoWrite } from "./noghtePromo";

/**
 * Keeps Noghte's sponsor cards in step with NX Ads, through Noghte's admin routes as the signed-in
 * admin (`auth.ts`). Cards NX Ads made are named `nx-…`; one no longer published is switched off,
 * never deleted, and the others' order is kept after NX Ads' own.
 */

/** A card as Noghte's panel lists it. */
export type PromoRow = {
  id: string;
  /** The app's place for cards; only "calendar" so far. */
  slot: string;
  rank: number;
  on: boolean;
  card: PromoCard;
};

export type SyncPlan = {
  /** Each card to write, in order: NX Ads' live cards on, its old ones off. */
  puts: { id: string; body: { slot: string; on: boolean; card: PromoCard } }[];
  /** The place's order: NX Ads' live cards by share, then everyone else's as they were. */
  order: string[];
};

export const isOurs = (id: string): boolean => id.startsWith("nx-");

/** What to write so Noghte's list matches what NX Ads publishes; pure, for the tests. */
export function planPromoSync(writes: readonly PromoWrite[], rows: readonly PromoRow[]): SyncPlan {
  const live = new Set(writes.map((w) => w.id));
  const stale = rows.filter((r) => isOurs(r.id) && !live.has(r.id) && r.on);
  const others = rows
    .filter((r) => r.slot === "calendar" && !live.has(r.id) && !isOurs(r.id))
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.id);
  const oldOurs = rows.filter((r) => isOurs(r.id) && !live.has(r.id)).map((r) => r.id);
  return {
    puts: [
      ...writes.map((w) => ({ id: w.id, body: { slot: w.slot, on: true, card: w.card } })),
      ...stale.map((r) => ({ id: r.id, body: { slot: r.slot, on: false, card: r.card } })),
    ],
    order: [...writes.map((w) => w.id), ...others, ...oldOurs],
  };
}

/** Writes NX Ads' cards to Noghte's server; returns how many were written and switched off. */
export async function syncPromos(
  writes: readonly PromoWrite[],
): Promise<{ on: number; off: number }> {
  const { promos } = await call<{ promos: PromoRow[] }>("GET", "/admin/api/promos");
  const plan = planPromoSync(writes, promos);
  for (const p of plan.puts) await call("PUT", `/admin/api/promos/${p.id}`, p.body);
  await call("PUT", "/admin/api/promos-order", { slot: "calendar", ids: plan.order });
  return { on: writes.length, off: plan.puts.length - writes.length };
}
