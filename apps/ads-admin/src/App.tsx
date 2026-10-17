import { SAMPLE_ADS, type Bundle } from "@dotlife/ads";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Ctx, go, useAds, useCampaigns, useRoute, type AppContext } from "./context";
import { SAMPLE_CAMPAIGNS, SAMPLE_CREATIVES } from "./data/samples";
import { CampaignForm } from "./pages/CampaignForm";
import { Campaigns } from "./pages/Campaigns";
import { AUTH_REQUIRED, authState, onAuth, restore, signOut, watchIdle } from "./data/auth";
import { LocalEventsStore } from "./data/events";
import { LocalAdsStore } from "./data/store";
import { AdForm } from "./pages/AdForm";
import { AdsList } from "./pages/AdsList";
import { Dashboard } from "./pages/Dashboard";
import { Publish } from "./pages/Publish";
import { Slots } from "./pages/Slots";
import { num } from "./data/labels";
import { NxStudioMark } from "./ui/NxStudioMark";
import { SignInPage } from "./ui/SignIn";
import { Tabs } from "./ui/Tabs";

/** In development, a published bundle also goes to the dev server's bundle route (vite.config.ts). */
async function postToDevRoute(bundle: Bundle): Promise<void> {
  const r = await fetch("/v1/ads/bundle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bundle),
  });
  if (!r.ok) throw new Error(`bundle route: ${String(r.status)}`);
}

type Page = "slots" | "campaigns" | "ads" | "publish" | "dashboard";

/** Who is signed in, and the way out. */
function Account() {
  const { phone } = useSyncExternalStore(onAuth, authState);
  if (phone === null) return null;
  return (
    <span className="account">
      <span dir="ltr">{phone}</span>
      <button
        type="button"
        className="btn ghost sm"
        onClick={() => {
          void signOut();
        }}
      >
        خروج
      </button>
    </span>
  );
}

function Shell() {
  const route = useRoute();
  const { ads } = useAds();
  const { campaigns } = useCampaigns();
  const page: Page =
    route.page === "ad" ? "ads" : route.page === "campaign" ? "campaigns" : route.page;
  // a form opened for another ad (or a new one) starts over instead of keeping the last one's text
  const pageKey =
    route.page === "ad"
      ? `ad:${route.id}:${String(route.slot ?? "")}:${route.campaign ?? ""}`
      : route.page === "campaign"
        ? `campaign:${route.id}`
        : route.page;
  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#/slots">
          <NxStudioMark width={76} />
          <span className="brand-sep" aria-hidden="true" />
          <b>Ads</b>
        </a>
        <Tabs<Page>
          label="بخش‌های پنل"
          value={page}
          onChange={(p) => {
            go(`#/${p}`);
          }}
          items={[
            { id: "slots", label: "جایگاه‌ها" },
            { id: "campaigns", label: "کمپین‌ها", count: num(campaigns.length) },
            { id: "ads", label: "آگهی‌ها", count: num(ads.length) },
            { id: "publish", label: "انتشار" },
            { id: "dashboard", label: "داشبورد" },
          ]}
        />
        <div className="top-end">
          <Account />
          <span
            className="store-chip"
            title="تبلیغ‌ها در همین مرورگر نگه داشته می‌شوند تا سرور آماده شود"
          >
            ذخیره‌ی محلی
          </span>
        </div>
      </header>
      <main className="page" key={pageKey}>
        {route.page === "slots" && <Slots />}
        {route.page === "ads" && <AdsList filter={route.filter} />}
        {route.page === "campaigns" && <Campaigns />}
        {route.page === "campaign" && <CampaignForm id={route.id} />}
        {route.page === "ad" && (
          <AdForm id={route.id} slot={route.slot} campaign={route.campaign} />
        )}
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
      ads: new LocalAdsStore({
        seed: SAMPLE_ADS,
        seedCampaigns: { campaigns: SAMPLE_CAMPAIGNS, ads: SAMPLE_CREATIVES },
        ...(import.meta.env.DEV ? { mirror: postToDevRoute } : {}),
      }),
      events: new LocalEventsStore(),
      toast,
    }),
    [toast],
  );
  const auth = useSyncExternalStore(onAuth, authState);
  useEffect(() => {
    void restore();
    return watchIdle();
  }, []);
  if (AUTH_REQUIRED && auth.restoring) return <p className="loading gate">در حال ورود…</p>;
  if (AUTH_REQUIRED && auth.phone === null) return <SignInPage />;
  return (
    <Ctx.Provider value={ctx}>
      <Shell />
      <div className={message === null ? "toast" : "toast on"} role="status" aria-live="polite">
        {message}
      </div>
    </Ctx.Provider>
  );
}
