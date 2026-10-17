import type { AdFilter } from "./logic";
import { PHASE_LABEL, PRODUCT_LABEL, type Phase } from "./labels";
import { slotById, type Product } from "@dotlife/ads";

/** The panel's pages, kept in the URL's hash so a slot's card can open a filtered list. */

export type Route =
  | { page: "slots" }
  | { page: "ads"; filter: AdFilter }
  | { page: "ad"; id: string; slot: number | undefined; campaign: string | undefined }
  | { page: "campaigns" }
  | { page: "campaign"; id: string }
  | { page: "publish" }
  | { page: "dashboard" };

const isPhase = (v: string | null): v is Phase => v !== null && v in PHASE_LABEL;
const isProduct = (v: string | null): v is Product => v !== null && v in PRODUCT_LABEL;
const slotParam = (v: string | null): number | undefined => {
  const n = Number(v);
  return v !== null && slotById(n) !== undefined ? n : undefined;
};

export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#\/?/, "").split("?");
  const p = new URLSearchParams(query);
  const parts = path.split("/").filter((x) => x !== "");
  const head = parts[0];
  if (head === "ads") {
    if (parts[1] === "new")
      return {
        page: "ad",
        id: "new",
        slot: slotParam(p.get("slot")),
        campaign: p.get("campaign") ?? undefined,
      };
    if (parts[1] === "edit" && parts[2] !== undefined)
      return { page: "ad", id: decodeURIComponent(parts[2]), slot: undefined, campaign: undefined };
    const phase = p.get("status");
    const product = p.get("product");
    return {
      page: "ads",
      filter: {
        slot: slotParam(p.get("slot")),
        phase: isPhase(phase) ? phase : undefined,
        product: isProduct(product) ? product : undefined,
        advertiser: p.get("advertiser") ?? undefined,
        q: p.get("q") ?? undefined,
      },
    };
  }
  if (head === "campaigns") {
    if (parts[1] === "new") return { page: "campaign", id: "new" };
    if (parts[1] === "edit" && parts[2] !== undefined)
      return { page: "campaign", id: decodeURIComponent(parts[2]) };
    return { page: "campaigns" };
  }
  if (head === "publish") return { page: "publish" };
  if (head === "dashboard") return { page: "dashboard" };
  return { page: "slots" };
}

export function adsHash(filter: AdFilter): string {
  const p = new URLSearchParams();
  if (filter.slot !== undefined) p.set("slot", String(filter.slot));
  if (filter.phase !== undefined) p.set("status", filter.phase);
  if (filter.product !== undefined) p.set("product", filter.product);
  if (filter.advertiser !== undefined && filter.advertiser !== "")
    p.set("advertiser", filter.advertiser);
  if (filter.q !== undefined && filter.q !== "") p.set("q", filter.q);
  const s = p.toString();
  return `#/ads${s === "" ? "" : `?${s}`}`;
}

export function newAdHash(slot?: number, campaign?: string): string {
  const p = new URLSearchParams();
  if (slot !== undefined) p.set("slot", String(slot));
  if (campaign !== undefined) p.set("campaign", campaign);
  const q = p.toString();
  return q === "" ? "#/ads/new" : `#/ads/new?${q}`;
}
export const campaignHash = (id: string): string => `#/campaigns/edit/${encodeURIComponent(id)}`;
export const editHash = (id: string): string => `#/ads/edit/${encodeURIComponent(id)}`;
