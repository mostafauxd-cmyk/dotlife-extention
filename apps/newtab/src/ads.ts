import { useEffect, useMemo, useState } from "react";

import { pickAd, SAMPLE_ADS, type Ad, type AdContext } from "@dotlife/ads";

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
  const [, tick] = useState(0);
  useEffect(() => {
    const l = (): void => {
      tick((t) => t + 1);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const key = JSON.stringify(over);
  return useMemo(
    () =>
      pickAd(bundle, slot, {
        product: "newtab",
        now: new Date(),
        persona: s.persona,
        consent: isOn(s, "ads"),
        dismissed,
        ...over,
      }),
    [slot, s.persona, s.off, key, tick],
  );
}

/** The label every ad carries. */
export const AD_LABEL = "معرفی‌شده";
