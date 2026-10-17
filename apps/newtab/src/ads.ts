import { useEffect, useMemo, useState } from "react";

import { pickAd, SAMPLE_ADS, type Ad, type AdContext } from "@dotlife/ads";

import { traitsOf } from "./adTraits";
import { useSettings } from "./hooks";
import { isOn } from "./settings";

/**
 * Ads in the new tab: native boxes that fill the design's slots (`@dotlife/ads`). The client picks
 * the ad on the device from a bundle by the rules there — consent (the «پیشنهادهای معرفی‌شده»
 * switch in «شخصی‌سازی»), schedule, and only who/when/search-word targeting, never anything the
 * person wrote or owns. Until a server sends a signed bundle, the sample's one-ad-per-slot set is
 * what is drawn, so the slots can be seen and styled.
 */

let bundle: readonly Ad[] = SAMPLE_ADS;
const listeners = new Set<() => void>();

/** Replaces the ads in hand (a bundle read from the server). */
export function setAds(next: readonly Ad[]): void {
  bundle = next;
  for (const l of listeners) l();
}

const dismissed = new Set<string>();

/** «بستن»: the ad is put away until the tab is opened again. */
export function dismissAd(id: string): void {
  dismissed.add(id);
  for (const l of listeners) l();
}

/**
 * The ad for one slot, or null. `over` adds what only the caller knows (the typed search word, the
 * occasion of the day).
 */
export function useAd(slot: number, over: Partial<AdContext> = {}): Ad | null {
  const s = useSettings();
  // bumped by `setAds` and `dismissAd`, so a bundle that arrives later is drawn too
  const [version, bump] = useState(0);
  useEffect(() => {
    const l = (): void => {
      bump((t) => t + 1);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const key = JSON.stringify(over);
  return useMemo(() => {
    const tr = traitsOf(s);
    const base: AdContext = {
      product: "newtab",
      now: new Date(),
      persona: tr.persona,
      city: tr.city,
      season: tr.season,
      weekend: tr.weekend,
      consent: isOn(s, "ads"),
      dismissed,
      ...over,
    };
    // each topic the person follows and each occasion today is a way to match; the heaviest ad wins
    let best: Ad | null = null;
    for (const topic of [...tr.topics, null]) {
      for (const occasion of [...tr.occasions, null]) {
        const ad = pickAd(bundle, slot, { ...base, topic, occasion });
        if (ad !== null && (best === null || ad.weight > best.weight)) best = ad;
      }
    }
    return best;
  }, [slot, s.persona, s.city, s.topics, s.off, key, version]);
}

/** The label every ad carries. */
export const AD_LABEL = "معرفی‌شده";
