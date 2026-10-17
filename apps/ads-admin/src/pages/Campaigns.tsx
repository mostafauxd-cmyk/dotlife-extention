import { allocate, dailyBudget, PRODUCTS, type Campaign, type Product } from "@dotlife/ads";
import { useState } from "react";

import { go, useAds, useApp, useCampaigns } from "../context";
import { MODEL_LABEL, num, PHASE_LABEL, PRODUCT_LABEL, toman } from "../data/labels";
import { campaignPhase, duplicateCampaign, newAdId } from "../data/logic";
import { campaignHash } from "../data/route";
import { ConfirmDialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/Tabs";

export function Campaigns() {
  const { ads: store, toast } = useApp();
  const { campaigns, ready } = useCampaigns();
  const { ads } = useAds();
  const [product, setProduct] = useState<Product | "all">("all");
  const [toDelete, setToDelete] = useState<Campaign | undefined>();
  const now = new Date();

  const forecast = allocate(campaigns, now);
  const shown = campaigns.filter(
    (c) => product === "all" || c.products.some((p) => p.product === product),
  );
  const running = campaigns.filter((c) => campaignPhase(c, now) === "live");
  const todaySpend = [...forecast.campaigns.values()].reduce((s, t) => s + t.spend, 0);
  const todayBudget = running.reduce((s, c) => s + dailyBudget(c, now), 0);

  const run = (job: Promise<void>, done: string): void => {
    job.then(
      () => {
        toast(done);
      },
      () => {
        toast("ذخیره نشد.");
      },
    );
  };
  const toggle = (c: Campaign): void => {
    const next: Campaign = { ...c, status: c.status === "live" ? "paused" : "live" };
    run(store.putCampaign(next), next.status === "live" ? "کمپین اجرا شد." : "کمپین متوقف شد.");
  };

  return (
    <>
      <section className="intro">
        <div>
          <h1>کمپین‌ها</h1>
          <p>
            هر کمپین برای یک مشتری است: انتخاب می‌کنی در کدام محصول‌ها و جایگاه‌ها اجرا شود، هر
            محصول چه هدف‌گیری‌ای داشته باشد، و با پیشنهاد قیمت و بودجه، سهمش از هر جایگاه معلوم
            می‌شود.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            go("#/campaigns/new");
          }}
        >
          <Icon name="plus" size={17} />
          کمپین تازه
        </button>
      </section>

      <section className="kpis" aria-label="خلاصه‌ی امروز">
        <div className="card kpi">
          <small>در حال اجرا</small>
          <b>{num(running.length)}</b>
        </div>
        <div className="card kpi">
          <small>خرج پیش‌بینی‌شده‌ی امروز</small>
          <b>{toman(todaySpend)}</b>
        </div>
        <div className="card kpi">
          <small>بودجه‌ی روزانه‌ی کمپین‌ها</small>
          <b>{toman(todayBudget)}</b>
        </div>
      </section>

      <div className="switches">
        <Tabs<Product | "all">
          label="محصول"
          value={product}
          onChange={setProduct}
          items={[
            { id: "all", label: "همه", count: num(campaigns.length) },
            ...PRODUCTS.map((p) => ({
              id: p,
              label: PRODUCT_LABEL[p],
              count: num(campaigns.filter((c) => c.products.some((x) => x.product === p)).length),
            })),
          ]}
        />
      </div>

      <section className="card list">
        {shown.length > 0 && (
          <div className="cmp-head">
            <span>کمپین</span>
            <span>محصول‌ها</span>
            <span>قیمت</span>
            <span>بودجه</span>
            <span>امروز</span>
            <span>وضعیت</span>
            <span />
          </div>
        )}
        {shown.map((c) => {
          const phase = campaignPhase(c, now);
          const t = forecast.campaigns.get(c.id);
          const spentShare = Math.min(1, (c.spent ?? 0) / c.budget.total);
          const count = ads.filter((a) => a.campaign === c.id).length;
          return (
            <div key={c.id} className="cmp-row">
              <button
                type="button"
                className="ad-title"
                onClick={() => {
                  go(campaignHash(c.id));
                }}
              >
                <b>{c.name}</b>
                <small>
                  {c.advertiser} · {num(count)} آگهی
                </small>
              </button>
              <span className="ad-products">
                {c.products.map((p) => (
                  <span key={p.product} className="mini-chip">
                    {PRODUCT_LABEL[p.product]} · {num(p.slots.length)}
                  </span>
                ))}
              </span>
              <span className="cmp-bid">
                <b>{toman(c.bid)}</b>
                <small>{MODEL_LABEL[c.model]}</small>
              </span>
              <span className="cmp-budget">
                <small>
                  {toman(c.spent ?? 0)} از {toman(c.budget.total)}
                </small>
                <span className="meter" aria-hidden="true">
                  <i style={{ width: `${String(spentShare * 100)}%` }} />
                </span>
              </span>
              <span className="cmp-today">
                {t === undefined ? (
                  <small>—</small>
                ) : (
                  <>
                    <b>{toman(t.spend)}</b>
                    <small>{num(t.impressions)} نمایش</small>
                  </>
                )}
              </span>
              <span>
                <span className={`badge ${phase}`}>{PHASE_LABEL[phase]}</span>
              </span>
              <span className="row-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title={c.status === "live" ? "توقف" : "اجرا"}
                  aria-label={`${c.status === "live" ? "توقف" : "اجرا"} ${c.name}`}
                  onClick={() => {
                    toggle(c);
                  }}
                >
                  <Icon name={c.status === "live" ? "pause" : "play"} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="کپی"
                  aria-label={`کپی ${c.name}`}
                  onClick={() => {
                    run(
                      store.putCampaign(duplicateCampaign(c, newAdId(now, Math.random, "cmp"))),
                      "کپی کمپین ساخته شد.",
                    );
                  }}
                >
                  <Icon name="copy" />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="حذف"
                  aria-label={`حذف ${c.name}`}
                  onClick={() => {
                    setToDelete(c);
                  }}
                >
                  <Icon name="trash" />
                </button>
              </span>
            </div>
          );
        })}
        {ready && shown.length === 0 && (
          <div className="blank">
            <b>{campaigns.length === 0 ? "هنوز کمپینی نیست" : "کمپینی در این محصول نیست"}</b>
            <p>کمپین بساز، محصول‌ها و جایگاه‌هایش را بردار و بودجه بگذار.</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                go("#/campaigns/new");
              }}
            >
              <Icon name="plus" size={17} />
              کمپین تازه
            </button>
          </div>
        )}
      </section>

      {toDelete !== undefined && (
        <ConfirmDialog
          title="حذف کمپین"
          message={`«${toDelete.name}» و آگهی‌هایش برای همیشه حذف می‌شوند. برای نگه‌داشتن، به‌جای حذف آن را متوقف کن.`}
          confirm="حذف"
          onConfirm={() => {
            const c = toDelete;
            setToDelete(undefined);
            run(store.deleteCampaign(c.id), "کمپین حذف شد.");
          }}
          onClose={() => {
            setToDelete(undefined);
          }}
        />
      )}
    </>
  );
}
