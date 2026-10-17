import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { Ad, Bundle, Campaign } from "@dotlife/ads";

import type { EventsStore, StatRow } from "./data/events";
import { parseRoute, type Route } from "./data/route";
import type { AdsStore } from "./data/store";

/** What every page shares: the two stores, a toast, and the route read from the URL's hash. */

export type AppContext = {
  ads: AdsStore;
  events: EventsStore;
  toast: (message: string) => void;
};

export const Ctx = createContext<AppContext | undefined>(undefined);

export function useApp(): AppContext {
  const c = useContext(Ctx);
  if (c === undefined) throw new Error("no app context");
  return c;
}

const subscribeHash = (cb: () => void): (() => void) => {
  window.addEventListener("hashchange", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
  };
};
const getHash = (): string => window.location.hash;

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeHash, getHash);
  return parseRoute(hash);
}

/** Moves to a page; `replace` swaps the entry instead of adding one (typing in a filter). */
export function go(hash: string, replace = false): void {
  if (replace) {
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new Event("hashchange"));
  } else {
    window.location.hash = hash;
  }
}

/** The list of ads, reloaded whenever the store says it changed. */
export function useAds(): { ads: Ad[]; ready: boolean } {
  const { ads: store } = useApp();
  const [state, setState] = useState<{ ads: Ad[]; ready: boolean }>({ ads: [], ready: false });
  useEffect(() => {
    let live = true;
    const load = (): void => {
      void store.list().then((ads) => {
        if (live) setState({ ads, ready: true });
      });
    };
    load();
    const stop = store.subscribe(load);
    return () => {
      live = false;
      stop();
    };
  }, [store]);
  return state;
}

export function useLastBundle(): Bundle | undefined | null {
  const { ads: store } = useApp();
  // null while loading, undefined when nothing was ever published
  const [bundle, setBundle] = useState<Bundle | undefined | null>(null);
  useEffect(() => {
    let live = true;
    const load = (): void => {
      void store.lastBundle().then((b) => {
        if (live) setBundle(b);
      });
    };
    load();
    const stop = store.subscribe(load);
    return () => {
      live = false;
      stop();
    };
  }, [store]);
  return bundle;
}

export function useStats(): StatRow[] {
  const { events } = useApp();
  const [rows, setRows] = useState<StatRow[]>([]);
  useEffect(() => {
    let live = true;
    const load = (): void => {
      void events.stats().then((r) => {
        if (live) setRows(r);
      });
    };
    load();
    const stop = events.subscribe(load);
    return () => {
      live = false;
      stop();
    };
  }, [events]);
  return rows;
}

/** The campaigns, reloaded whenever the store says something changed. */
export function useCampaigns(): { campaigns: Campaign[]; ready: boolean } {
  const { ads: store } = useApp();
  const [state, setState] = useState<{ campaigns: Campaign[]; ready: boolean }>({
    campaigns: [],
    ready: false,
  });
  useEffect(() => {
    let live = true;
    const load = (): void => {
      void store.listCampaigns().then((campaigns) => {
        if (live) setState({ campaigns, ready: true });
      });
    };
    load();
    const stop = store.subscribe(load);
    return () => {
      live = false;
      stop();
    };
  }, [store]);
  return state;
}
