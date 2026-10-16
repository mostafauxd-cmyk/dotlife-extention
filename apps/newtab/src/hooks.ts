import { useEffect, useState, useSyncExternalStore } from "react";

import { currentSession, onSession } from "./noghte/api";
import { records } from "./noghte/records";
import { onSyncState, syncState } from "./noghte/sync";
import { onSettings, settings } from "./settings";

/** Re-renders whenever the records change (a sync, or an edit here). */
export function useRecordsVersion(): number {
  const [v, setV] = useState(0);
  useEffect(
    () =>
      records.onChange(() => {
        setV((x) => x + 1);
      }),
    [],
  );
  return v;
}

export const useSession = () => useSyncExternalStore(onSession, currentSession);
export const useSyncState = () => useSyncExternalStore(onSyncState, syncState);
export const useSettings = () => useSyncExternalStore(onSettings, settings);

/** The time now, ticking each `ms` (a clock, «x دقیقه پیش»). */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date());
    }, ms);
    return () => {
      clearInterval(t);
    };
  }, [ms]);
  return now;
}
