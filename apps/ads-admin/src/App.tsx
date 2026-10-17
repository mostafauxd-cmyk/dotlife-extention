import { SAMPLE_ADS } from "@dotlife/ads";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Ctx, go, useAds, useRoute, type AppContext } from "./context";
import { LocalEventsStore } from "./data/events";
import { LocalAdsStore } from "./data/store";
import { AdForm } from "./pages/AdForm";
import { AdsList } from "./pages/AdsList";
import { Dashboard } from "./pages/Dashboard";
import { Publish } from "./pages/Publish";
import { Slots } from "./pages/Slots";
import { num } from "./data/labels";
import { Tabs } from "./ui/Tabs";

type Page = "slots" | "ads" | "publish" | "dashboard";

function Shell() {
  const route = useRoute();
  const { ads } = useAds();
  const page: Page = route.page === "ad" ? "ads" : route.page;
  // a form opened for another ad (or a new one) starts over instead of keeping the last one's text
  const pageKey = route.page === "ad" ? `ad:${route.id}:${String(route.slot ?? "")}` : route.page;
  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#/slots">
          <span className="brand-dot" />
          <b>تبلیغات نقطه</b>
          <small>پنل مدیریت</small>
        </a>
        <Tabs<Page>
          label="بخش‌های پنل"
          value={page}
          onChange={(p) => {
            go(`#/${p}`);
          }}
          items={[
            { id: "slots", label: "جایگاه‌ها" },
            { id: "ads", label: "تبلیغ‌ها", count: num(ads.length) },
            { id: "publish", label: "انتشار" },
            { id: "dashboard", label: "داشبورد" },
          ]}
        />
        <span
          className="store-chip"
          title="تبلیغ‌ها در همین مرورگر نگه داشته می‌شوند تا سرور آماده شود"
        >
          ذخیره‌ی محلی
        </span>
      </header>
      <main className="page" key={pageKey}>
        {route.page === "slots" && <Slots />}
        {route.page === "ads" && <AdsList filter={route.filter} />}
        {route.page === "ad" && <AdForm id={route.id} slot={route.slot} />}
        {route.page === "publish" && <Publish />}
        {route.page === "dashboard" && <Dashboard />}
      </main>
    </div>
  );
}

export function App() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const toast = useCallback((m: string) => {
    setMessage(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setMessage(null);
    }, 3200);
  }, []);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );
  // the sample ads are the starting point until the owner has saved any of their own
  const ctx = useMemo<AppContext>(
    () => ({
      ads: new LocalAdsStore({ seed: SAMPLE_ADS }),
      events: new LocalEventsStore(),
      toast,
    }),
    [toast],
  );
  return (
    <Ctx.Provider value={ctx}>
      <Shell />
      <div className={message === null ? "toast" : "toast on"} role="status" aria-live="polite">
        {message}
      </div>
    </Ctx.Provider>
  );
}
