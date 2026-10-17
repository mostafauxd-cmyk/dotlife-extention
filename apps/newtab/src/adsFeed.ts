import { bundleSchema } from "@dotlife/ads";

import { setAds } from "./ads";

/**
 * Where the ads come from when a bundle server is set (`VITE_ADS_URL`, e.g. the NX Ads panel's dev
 * server on :5190, later the real server): `GET /v1/ads/bundle`, read with the shared schema, then
 * handed to `setAds`. Read once at start and again every half minute while the tab is seen.
 * Without it the sample bundle stays. TODO: verify the bundle's ed25519 signature once it is signed.
 */

const EVERY_MS = 30_000;

export async function pullBundle(base: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const r = await fetcher(`${base.replace(/\/$/, "")}/v1/ads/bundle`, { cache: "no-store" });
    if (!r.ok) return false;
    const parsed = bundleSchema.safeParse(await r.json());
    if (!parsed.success) return false;
    setAds(parsed.data.ads);
    return true;
  } catch {
    return false;
  }
}

export function startAdsFeed(): void {
  const base: unknown = import.meta.env.VITE_ADS_URL;
  if (typeof base !== "string" || base === "") return;
  void pullBundle(base);
  window.setInterval(() => {
    if (document.visibilityState === "visible") void pullBundle(base);
  }, EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void pullBundle(base);
  });
}
