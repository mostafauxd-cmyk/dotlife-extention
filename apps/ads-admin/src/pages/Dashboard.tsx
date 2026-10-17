import { PLACEMENTS, PRODUCTS, type Product } from "@dotlife/ads";
import { useState } from "react";

import { useApp, useAds, useCampaigns, useStats } from "../context";
import { campaignStats, ctr, demoEvents, sinceDay, summarize } from "../data/events";
import { MODEL_LABEL, num, pct, PRODUCT_LABEL, toman } from "../data/labels";
import { campaignHash } from "../data/route";
import { Tabs } from "../ui/Tabs";

type Period = 7 | 30 | 0;

export function Dashboard() {
  const { events, toast } = useApp();
  const { ads } = useAds();
  const { campaigns } = useCampaigns();
  const rows = useStats();
  const [product, setProduct] = useState<Product | "all">("all");
  const [period, setPeriod] = useState<Period>(7);
  const now = new Date();

  const filter = { product, since: period === 0 ? undefined : sinceDay(now, period) };
  const sum = summarize(rows, filter);
  const perCampaign = campaignStats(rows, ads, campaigns, filter).sort(
    (a, b) => b.impressions - a.impressions,
  );
  const spend = perCampaign.reduce((s, c) => s + (c.spend ?? 0), 0);
  const title = (id: string): string => ads.find((a) => a.id === id)?.title ?? id;
  const places = PLACEMENTS.filter((s) => product === "all" || s.product === product);
  const maxShown = Math.max(1, ...[...sum.bySlot.values()].map((t) => t.impressions));
  const hasData = sum.total.impressions > 0 || sum.total.clicks > 0;
  const topShown = sum.byAd.slice(0, 5);
  // a click rate on a few showings says nothing, so the ranking waits for a hundred
  const topCtr = sum.byAd
    .filter((a) => a.impressions >= 100)
    .sort((a, b) => ctr(b) - ctr(a))
    .slice(0, 5);

  const seed = (): void => {
    void (async () => {
      for (const e of demoEvents(ads, now)) await events.record(e);
      toast("داده‌ی آزمایشی اضافه شد.");
    })();
  };

  return (
    <>
      <section className="intro">
        <div>
          <h1>
            داشبورد <span className="badge draft">نسخه‌ی اول</span>
          </h1>
          <p>
            نمایش، کلیک و خرج هر محصول، جایگاه، کمپین و آگهی در یک جا: نیوتب، اپ نقطه، پاکت و
            محصول‌های بعدی. بدون هیچ شناسه‌ی شخصی. فعلاً از یک ذخیره‌ی محلی می‌خواند؛ کلاینت‌ها
            بعداً رویدادها را به <code>POST /v1/ads/events</code> می‌فرستند.
          </p>
        </div>
        <div className="btn-row">
          <button type="button" className="btn ghost sm" onClick={seed} disabled={ads.length === 0}>
            افزودن داده‌ی آزمایشی
          </button>
          <button
            type="button"
            className="btn ghost sm danger"
            disabled={rows.length === 0}
            onClick={() => {
              void events.clear().then(() => {
                toast("شمارنده‌ها پاک شد.");
              });
            }}
          >
            پاک کردن شمارنده‌ها
          </button>
        </div>
      </section>

      <div className="switches">
        <Tabs<Product | "all">
          label="محصول"
          value={product}
          onChange={setProduct}
          items={[
            { id: "all", label: "همه‌ی محصول‌ها" },
            ...PRODUCTS.map((p) => ({ id: p, label: PRODUCT_LABEL[p] })),
          ]}
        />
        <Tabs<Period>
          size="sm"
          label="بازه"
          value={period}
          onChange={setPeriod}
          items={[
            { id: 7, label: "۷ روز" },
            { id: 30, label: "۳۰ روز" },
            { id: 0, label: "همه" },
          ]}
        />
      </div>

      <section className="kpis four" aria-label="جمع‌ها">
        <div className="card kpi">
          <small>نمایش</small>
          <b>{num(sum.total.impressions)}</b>
        </div>
        <div className="card kpi">
          <small>کلیک</small>
          <b>{num(sum.total.clicks)}</b>
        </div>
        <div className="card kpi">
          <small>نرخ کلیک (CTR)</small>
          <b>{hasData ? pct(ctr(sum.total) * 100) : "—"}</b>
        </div>
        <div className="card kpi">
          <small>خرج کمپین‌ها (تومان)</small>
          <b>{hasData ? toman(spend) : "—"}</b>
        </div>
      </section>

      {!hasData && (
        <section className="card blank">
          <b>
            {product === "all"
              ? "هنوز رویدادی ثبت نشده"
              : `برای ${PRODUCT_LABEL[product]} هنوز رویدادی نیست`}
          </b>
          <p>
            کلاینت‌ها هنوز رویداد نمی‌فرستند. با «افزودن داده‌ی آزمایشی» می‌توانی داشبورد را با
            شمارنده‌های ساختگی ببینی؛ آن‌ها فقط در همین مرورگرند.
          </p>
        </section>
      )}

      {hasData && (
        <>
          <section className="card">
            <h2>کمپین‌ها</h2>
            {perCampaign.length === 0 ? (
              <p className="note">در این بازه کمپینی نمایش نداشته است.</p>
            ) : (
              <div className="stat-table">
                <div className="stat-head cmp">
                  <span>کمپین</span>
                  <span>نمایش</span>
                  <span>کلیک</span>
                  <span>CTR</span>
                  <span>خرج</span>
                  <span>بودجه</span>
                </div>
                {perCampaign.map((s) => {
                  const c = campaigns.find((x) => x.id === s.campaign);
                  if (c === undefined) return null;
                  const used = s.spend === undefined ? undefined : s.spend / c.budget.total;
                  return (
                    <div key={s.campaign} className="stat-row cmp">
                      <a className="stat-name" href={campaignHash(c.id)}>
                        <b>{c.name}</b>
                        <small>
                          {c.advertiser} · {MODEL_LABEL[c.model]}
                        </small>
                      </a>
                      <span>{num(s.impressions)}</span>
                      <span>{num(s.clicks)}</span>
                      <span>{pct(ctr(s) * 100)}</span>
                      <span>{s.spend === undefined ? "با گزارش آگهی‌دهنده" : toman(s.spend)}</span>
                      <span>
                        {used === undefined ? "—" : pct(Math.min(1, used) * 100)}
                        {used !== undefined && (
                          <i
                            className="bar"
                            style={{ width: `${String(Math.min(1, used) * 100)}%` }}
                          />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="two">
            <section className="card">
              <h2>جایگاه‌ها</h2>
              <div className="stat-table">
                <div className="stat-head">
                  <span>جایگاه</span>
                  <span>نمایش</span>
                  <span>کلیک</span>
                  <span>CTR</span>
                </div>
                {places.map((s) => {
                  const t = sum.bySlot.get(s.id);
                  return (
                    <div key={s.id} className={t === undefined ? "stat-row none" : "stat-row"}>
                      <span className="stat-name">
                        <span className="num">{num(s.id)}</span>
                        {s.name}
                        {product === "all" && <small>{PRODUCT_LABEL[s.product]}</small>}
                      </span>
                      <span>
                        {t === undefined ? "—" : num(t.impressions)}
                        {t !== undefined && (
                          <i
                            className="bar"
                            style={{ width: `${String((t.impressions / maxShown) * 100)}%` }}
                          />
                        )}
                      </span>
                      <span>{t === undefined ? "—" : num(t.clicks)}</span>
                      <span>{t === undefined ? "—" : pct(ctr(t) * 100)}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="stack">
              <section className="card">
                <h2>بیشترین نمایش</h2>
                <ol className="toplist">
                  {topShown.map((a) => (
                    <li key={a.ad}>
                      <span className="num">{num(a.slot)}</span>
                      <b>{title(a.ad)}</b>
                      <small>
                        {num(a.impressions)} نمایش · {pct(ctr(a) * 100)}
                      </small>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="card">
                <h2>بیشترین نرخ کلیک</h2>
                {topCtr.length === 0 ? (
                  <p className="note">هنوز آگهی‌ای به ۱۰۰ نمایش نرسیده.</p>
                ) : (
                  <ol className="toplist">
                    {topCtr.map((a) => (
                      <li key={a.ad}>
                        <span className="num">{num(a.slot)}</span>
                        <b>{title(a.ad)}</b>
                        <small>
                          {pct(ctr(a) * 100)} · {num(a.clicks)} کلیک
                        </small>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </div>
        </>
      )}

      <section className="card next">
        <h2>بعدی: شمارنده‌های واقعی هر محصول</h2>
        <p>
          داده‌ها از اول بر پایه‌ی محصول نگه داشته می‌شوند، پس محصول تازه فقط یک ردیف در کاتالوگ
          است. تا وقتی اپ نقطه، پاکت و نیوتب رویدادهایشان را به سرور نفرستند، این‌جا فقط داده‌ی
          آزمایشی دیده می‌شود.
        </p>
        <div className="pills">
          {PRODUCTS.map((p) => (
            <span key={p} className="mini-chip">
              {PRODUCT_LABEL[p]} · {num(PLACEMENTS.filter((s) => s.product === p).length)} جایگاه
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
