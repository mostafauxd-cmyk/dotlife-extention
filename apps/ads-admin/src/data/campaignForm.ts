import {
  campaignSchema,
  PRODUCTS,
  slotById,
  type Campaign,
  type CampaignStatus,
  type Product,
  type SaleModel,
  type Target,
} from "@dotlife/ads";

import { PRODUCT_LABEL } from "./labels";
import { issueMessage, issuePath } from "./validate";

/** The campaign form: what it holds as typed, how that becomes a campaign, and what is wrong with it. */

export type PlanDraft = {
  on: boolean;
  slots: number[];
  persona: string[];
  city: string[];
  season: string[];
  occasion: string[];
  keyword: string[];
  topic: string[];
  weekend: boolean;
};

export type CampaignDraft = {
  id: string;
  name: string;
  advertiser: string;
  status: CampaignStatus;
  from: string;
  until: string;
  model: SaleModel;
  bid: string;
  total: string;
  daily: string;
  spent: number | undefined;
  plans: Record<Product, PlanDraft>;
};

const blankPlan = (): PlanDraft => ({
  on: false,
  slots: [],
  persona: [],
  city: [],
  season: [],
  occasion: [],
  keyword: [],
  topic: [],
  weekend: false,
});

export function blankCampaign(id: string): CampaignDraft {
  return {
    id,
    name: "",
    advertiser: "",
    status: "draft",
    from: "",
    until: "",
    model: "per-thousand",
    bid: "",
    total: "",
    daily: "",
    spent: undefined,
    plans: Object.fromEntries(PRODUCTS.map((p) => [p, blankPlan()])) as Record<Product, PlanDraft>,
  };
}

export function campaignDraftFrom(c: Campaign): CampaignDraft {
  const d = blankCampaign(c.id);
  for (const plan of c.products) {
    d.plans[plan.product] = {
      on: true,
      slots: [...plan.slots],
      ...structuredClone(plan.targeting),
    };
  }
  return {
    ...d,
    name: c.name,
    advertiser: c.advertiser,
    status: c.status,
    from: c.from ?? "",
    until: c.until ?? "",
    model: c.model,
    bid: String(c.bid),
    total: String(c.budget.total),
    daily: c.budget.daily === undefined ? "" : String(c.budget.daily),
    spent: c.spent,
  };
}

/** The dimensions a product's chosen places may be aimed by: any one of them allows it. */
export function dimsOf(slots: readonly number[]): Set<Target> {
  const out = new Set<Target>();
  for (const id of slots) for (const t of slotById(id)?.targets ?? []) out.add(t);
  return out;
}

const text = (s: string): string | undefined => (s.trim() === "" ? undefined : s.trim());
const number = (s: string): number | undefined =>
  s.trim() === "" ? undefined : Number(s.replaceAll(",", "").replaceAll("٬", "").trim());

export function campaignToInput(d: CampaignDraft): Record<string, unknown> {
  const products = PRODUCTS.filter((p) => d.plans[p].on).map((product) => {
    const plan = d.plans[product];
    const dims = dimsOf(plan.slots);
    const keep = (dim: Target, list: string[]): string[] => (dims.has(dim) ? list : []);
    return {
      product,
      slots: plan.slots,
      targeting: {
        persona: keep("persona", plan.persona),
        city: keep("city", plan.city),
        season: keep("season", plan.season),
        occasion: keep("occasion", plan.occasion),
        keyword: keep("keyword", plan.keyword),
        topic: keep("topic", plan.topic),
        weekend: dims.has("weekend") && plan.weekend,
      },
    };
  });
  const daily = number(d.daily);
  return {
    id: d.id,
    name: d.name.trim(),
    advertiser: d.advertiser.trim(),
    status: d.status,
    from: text(d.from),
    until: text(d.until),
    model: d.model,
    bid: number(d.bid),
    budget: { total: number(d.total), ...(daily === undefined ? {} : { daily }) },
    products,
    ...(d.spent === undefined ? {} : { spent: d.spent }),
  };
}

export type CampaignValidation =
  { ok: true; campaign: Campaign } | { ok: false; errors: Record<string, string> };

/** The shared schema, then the form's own rules; messages keyed by field (`plan.paket` for a product). */
export function validateCampaign(d: CampaignDraft): CampaignValidation {
  const input = campaignToInput(d);
  const errors: Record<string, string> = {};
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success)
    for (const issue of parsed.error.issues) {
      const key = issuePath(issue.path).replace(/^budget\./, "");
      if (key.startsWith("products.")) continue;
      errors[key] ??= key === "products" ? "دست‌کم یک محصول را روشن کن." : issueMessage(issue);
    }
  for (const p of PRODUCTS) {
    const plan = d.plans[p];
    if (plan.on && plan.slots.length === 0)
      errors[`plan.${p}`] ??= `برای ${PRODUCT_LABEL[p]} دست‌کم یک جایگاه بردار.`;
  }
  const from = text(d.from);
  const until = text(d.until);
  if (from !== undefined && until !== undefined && from > until)
    errors["until"] ??= "روز پایان نباید پیش از روز شروع باشد.";
  const total = number(d.total);
  const daily = number(d.daily);
  if (total !== undefined && daily !== undefined && daily > total)
    errors["daily"] ??= "سقف روزانه از بودجه‌ی کل بیشتر است.";
  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, campaign: parsed.data };
}
