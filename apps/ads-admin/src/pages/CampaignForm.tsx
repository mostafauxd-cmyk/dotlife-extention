import {
  allocate,
  CAMPAIGN_STATUS,
  campaignSchema,
  dailyBudget,
  PRODUCT_INFO,
  PRODUCTS,
  placementsOf,
  SALE_MODELS,
  slotById,
  type Campaign,
  type Product,
} from "@dotlife/ads";
import { useEffect, useState, type SyntheticEvent } from "react";

import { go, useAds, useApp, useCampaigns } from "../context";
import {
  blankCampaign,
  campaignDraftFrom,
  campaignToInput,
  dimsOf,
  validateCampaign,
  type CampaignDraft,
  type PlanDraft,
} from "../data/campaignForm";
import {
  CAMPAIGN_STATUS_LABEL,
  jalali,
  MODEL_LABEL,
  MODEL_UNIT,
  num,
  PHASE_LABEL,
  PRODUCT_LABEL,
  TARGET_LABEL,
  toman,
} from "../data/labels";
import { adPhase, advertisers, campaignMap, duplicateCampaign, newAdId } from "../data/logic";
import { campaignHash, editHash, newAdHash } from "../data/route";
import { ConfirmDialog } from "../ui/Dialog";
import { ChipSet, Field } from "../ui/Fields";
import { CampaignForecast } from "../ui/Forecast";
import { Icon } from "../ui/Icon";
import { TargetingFields } from "../ui/TargetingFields";

/** The draft as a campaign running today, for the forecast; undefined while the price is missing. */
function asRunning(d: CampaignDraft): Campaign | undefined {
  const input = campaignToInput(d);
  const r = campaignSchema.safeParse({
    ...input,
    name: d.name.trim() === "" ? "—" : d.name,
    advertiser: d.advertiser.trim() === "" ? "—" : d.advertiser,
    status: "live",
    from: undefined,
    until: undefined,
  });
  return r.success ? r.data : undefined;
}

function ProductCard({
  product,
  plan,
  onChange,
  error,
}: {
  product: Product;
  plan: PlanDraft;
  onChange: (patch: Partial<PlanDraft>) => void;
  error: string | undefined;
}) {
  const info = PRODUCT_INFO[product];
  const dims = dimsOf(plan.slots);
  return (
    <div className={plan.on ? "prod-card on" : "prod-card"}>
      <label className="prod-head">
        <input
          type="checkbox"
          checked={plan.on}
          onChange={(e) => {
            onChange({ on: e.target.checked });
          }}
        />
        <b>{info.name}</b>
        <small>{info.platform}</small>
        {plan.on && plan.slots.length > 0 && (
          <span className="mini-chip">{num(plan.slots.length)} جایگاه</span>
        )}
      </label>
      {plan.on && (
        <div className="prod-body">
          <Field label="جایگاه‌ها" error={error} wide>
            {() => (
              <ChipSet
                label={`جایگاه‌های ${info.name}`}
                items={placementsOf(product).map((s) => ({
                  id: String(s.id),
                  label: `${num(s.id)} · ${s.name}`,
                }))}
                value={plan.slots.map(String)}
                onChange={(v) => {
                  onChange({ slots: v.map(Number).sort((a, b) => a - b) });
                }}
              />
            )}
          </Field>
          {plan.slots.length > 0 && (
            <>
              <p className="note">
                هدف‌گیری در {info.name}:{" "}
                {dims.size === 0
                  ? "این جایگاه‌ها هدف‌گیری ندارند."
                  : [...dims].map((t) => TARGET_LABEL[t]).join("، ")}
                . هر جایگاه فقط بُعدهای خودش را می‌خواند.
              </p>
              <TargetingFields
                allowed={dims}
                value={plan}
                onChange={(patch) => {
                  onChange(patch);
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Body({ initial, isNew }: { initial: CampaignDraft; isNew: boolean }) {
  const { ads: store, toast } = useApp();
  const { ads } = useAds();
  const { campaigns } = useCampaigns();
  const [d, setD] = useState<CampaignDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = new Date();

  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]): void => {
    setD((prev) => ({ ...prev, [k]: v }));
  };
  const setPlan = (p: Product, patch: Partial<PlanDraft>): void => {
    setD((prev) => ({ ...prev, plans: { ...prev.plans, [p]: { ...prev.plans[p], ...patch } } }));
  };

  const result = validateCampaign(d);
  const errors = !result.ok && submitted ? result.errors : {};
  const errorList = Object.values(errors);

  const running = asRunning(d);
  const others = campaigns.filter((c) => c.id !== d.id);
  const forecast = allocate(running === undefined ? others : [...others, running], now);
  const saved = campaigns.some((c) => c.id === d.id);
  const creatives = ads.filter((a) => a.campaign === d.id);
  const chosen = PRODUCTS.flatMap((p) => (d.plans[p].on ? d.plans[p].slots : []));
  const map = campaignMap(campaigns);

  const save = (e: SyntheticEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      toast("چند جای فرم درست نیست؛ زیر هر کادر نوشته شده.");
      window.requestAnimationFrame(() => {
        document
          .querySelector(".error-sum")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    store.putCampaign(result.campaign).then(
      () => {
        toast(isNew ? "کمپین ساخته شد. حالا برایش آگهی بساز." : "تغییرها ذخیره شد.");
        if (isNew) go(campaignHash(result.campaign.id), true);
      },
      () => {
        toast("ذخیره نشد.");
      },
    );
  };
  const duplicate = (): void => {
    if (!result.ok) return;
    const copy = duplicateCampaign(result.campaign, newAdId(new Date(), Math.random, "cmp"));
    store.putCampaign(copy).then(
      () => {
        toast("کپی کمپین به‌عنوان پیش‌نویس ساخته شد (بدون آگهی‌ها).");
        go(campaignHash(copy.id));
      },
      () => {
        toast("ذخیره نشد.");
      },
    );
  };
  const remove = (): void => {
    store.deleteCampaign(d.id).then(
      () => {
        toast("کمپین و آگهی‌هایش حذف شد.");
        go("#/campaigns");
      },
      () => {
        toast("حذف نشد.");
      },
    );
  };

  return (
    <form className="ad-form" onSubmit={save} noValidate>
      <div className="form-main">
        {errorList.length > 0 && (
          <div className="error-sum" role="alert">
            <Icon name="alert" />
            <div>
              <b>این کمپین هنوز ذخیره نشد</b>
              <ul>
                {errorList.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <section className="card">
          <h2>کمپین</h2>
          <div className="fields">
            <Field label="نام کمپین" error={errors["name"]}>
              {(id) => (
                <input
                  id={id}
                  value={d.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                  }}
                />
              )}
            </Field>
            <Field label="مشتری (آگهی‌دهنده)" error={errors["advertiser"]}>
              {(id) => (
                <>
                  <input
                    id={id}
                    list={`${id}-list`}
                    value={d.advertiser}
                    onChange={(e) => {
                      set("advertiser", e.target.value);
                    }}
                  />
                  <datalist id={`${id}-list`}>
                    {[...new Set([...advertisers(ads), ...campaigns.map((c) => c.advertiser)])].map(
                      (a) => (
                        <option key={a} value={a} />
                      ),
                    )}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="وضعیت" error={errors["status"]}>
              {(id) => (
                <select
                  id={id}
                  value={d.status}
                  onChange={(e) => {
                    const v = CAMPAIGN_STATUS.find((x) => x === e.target.value);
                    if (v !== undefined) set("status", v);
                  }}
                >
                  {CAMPAIGN_STATUS.map((x) => (
                    <option key={x} value={x}>
                      {CAMPAIGN_STATUS_LABEL[x]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <span />
            <Field
              label="از روز"
              error={errors["from"]}
              hint={d.from === "" ? "خالی یعنی از همین حالا." : jalali(d.from)}
            >
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={d.from}
                  onChange={(e) => {
                    set("from", e.target.value);
                  }}
                />
              )}
            </Field>
            <Field
              label="تا روز (و همان روز)"
              error={errors["until"]}
              hint={d.until === "" ? "خالی یعنی تا تمام شدن بودجه." : jalali(d.until)}
            >
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={d.until}
                  onChange={(e) => {
                    set("until", e.target.value);
                  }}
                />
              )}
            </Field>
          </div>
        </section>

        <section className="card">
          <h2>قیمت و بودجه</h2>
          <div className="fields">
            <Field label="مدل فروش" error={errors["model"]}>
              {(id) => (
                <select
                  id={id}
                  value={d.model}
                  onChange={(e) => {
                    const v = SALE_MODELS.find((m) => m === e.target.value);
                    if (v !== undefined) set("model", v);
                  }}
                >
                  {SALE_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {MODEL_LABEL[m]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="پیشنهاد قیمت (bid)" error={errors["bid"]} hint={MODEL_UNIT[d.model]}>
              {(id) => (
                <input
                  id={id}
                  inputMode="numeric"
                  dir="ltr"
                  value={d.bid}
                  onChange={(e) => {
                    set("bid", e.target.value);
                  }}
                />
              )}
            </Field>
            <Field
              label="بودجه‌ی کل (تومان)"
              error={errors["total"]}
              hint={d.spent === undefined ? undefined : `تا امروز ${toman(d.spent)} تومان خرج شده`}
            >
              {(id) => (
                <input
                  id={id}
                  inputMode="numeric"
                  dir="ltr"
                  value={d.total}
                  onChange={(e) => {
                    set("total", e.target.value);
                  }}
                />
              )}
            </Field>
            <Field
              label="سقف خرج روزانه (تومان)"
              error={errors["daily"]}
              hint="خالی یعنی باقی بودجه بر روزهای مانده پخش می‌شود."
            >
              {(id) => (
                <input
                  id={id}
                  inputMode="numeric"
                  dir="ltr"
                  value={d.daily}
                  onChange={(e) => {
                    set("daily", e.target.value);
                  }}
                />
              )}
            </Field>
          </div>
          <p className="note">
            اسپانسرها (روزانه، ماهانه، مناسبت) جایگاه را برای روزهایشان کامل می‌گیرند؛ بقیه به نسبت
            ارزش پیشنهادشان در هر هزار نمایش سهم می‌برند، تا جایی که بودجه‌ی روزانه اجازه بدهد.
          </p>
        </section>

        <section className="card">
          <h2>محصول‌ها، جایگاه‌ها و هدف‌گیری</h2>
          <div className="prods">
            {PRODUCTS.map((p) => (
              <ProductCard
                key={p}
                product={p}
                plan={d.plans[p]}
                error={errors[`plan.${p}`]}
                onChange={(patch) => {
                  setPlan(p, patch);
                }}
              />
            ))}
          </div>
          {errors["products"] !== undefined && <p className="field-err">{errors["products"]}</p>}
          <p className="note">
            هدف‌گیری فقط با پرسونا، شهر، فصل، مناسبت، آخر هفته، موضوع و کلمه‌ی سرچ است؛ هرگز از روی
            یادداشت، کار، تراکنش، بودجه یا دارایی کاربر.
          </p>
        </section>

        <section className="card">
          <h2>آگهی‌ها</h2>
          {!saved ? (
            <p className="note">اول کمپین را ذخیره کن، بعد برای هر جایگاه آگهی بساز.</p>
          ) : chosen.length === 0 ? (
            <p className="note">جایگاهی انتخاب نشده است.</p>
          ) : (
            <ul className="creatives">
              {chosen.map((id) => {
                const slot = slotById(id);
                const mine = creatives.filter((a) => a.slot === id);
                return (
                  <li key={id}>
                    <div className="cr-head">
                      <span className="num">{num(id)}</span>
                      <b>{slot?.name}</b>
                      <small>{slot === undefined ? "" : PRODUCT_LABEL[slot.product]}</small>
                      <a className="btn ghost sm" href={newAdHash(id, d.id)}>
                        <Icon name="plus" size={14} />
                        آگهی
                      </a>
                    </div>
                    {mine.length === 0 ? (
                      <p className="warn small">
                        بدون آگهی؛ این جایگاه برای این کمپین خالی می‌ماند.
                      </p>
                    ) : (
                      mine.map((a) => {
                        const ph = adPhase(a, now, map);
                        return (
                          <a key={a.id} className="cr-row" href={editHash(a.id)}>
                            <span>{a.title}</span>
                            <span className={`badge ${ph}`}>{PHASE_LABEL[ph]}</span>
                          </a>
                        );
                      })
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="form-actions">
          <button type="submit" className="btn">
            <Icon name="check" size={17} />
            ذخیره
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              go("#/campaigns");
            }}
          >
            برگشت
          </button>
          {saved && (
            <>
              <button type="button" className="btn ghost" onClick={duplicate}>
                <Icon name="copy" size={16} />
                کپی
              </button>
              <button
                type="button"
                className="btn ghost danger"
                onClick={() => {
                  setConfirmDelete(true);
                }}
              >
                <Icon name="trash" size={16} />
                حذف
              </button>
            </>
          )}
        </div>
      </div>

      <aside className="form-side">
        <div className="card sticky">
          <h2>سهم نمایش امروز</h2>
          {running === undefined ? (
            <p className="note">
              پیشنهاد قیمت و بودجه را وارد کن و جایگاه بردار تا سهم هر جایگاه دیده شود.
            </p>
          ) : (
            <>
              {d.status !== "live" && (
                <p className="note">اگر امروز اجرا شود؛ کمپین هنوز در حال اجرا نیست.</p>
              )}
              <CampaignForecast
                forecast={forecast}
                campaign={d.id}
                dailyBudget={dailyBudget(running, now)}
              />
            </>
          )}
        </div>
      </aside>

      {confirmDelete && (
        <ConfirmDialog
          title="حذف کمپین"
          message={`«${d.name}» و ${num(creatives.length)} آگهی‌اش برای همیشه حذف می‌شوند. برای نگه‌داشتن، به‌جای حذف آن را متوقف کن.`}
          confirm="حذف"
          onConfirm={remove}
          onClose={() => {
            setConfirmDelete(false);
          }}
        />
      )}
    </form>
  );
}

export function CampaignForm({ id }: { id: string }) {
  const { campaigns, ready } = useCampaigns();
  const isNew = id === "new";
  const [fresh] = useState(() => blankCampaign(newAdId(new Date(), Math.random, "cmp")));
  const found = campaigns.find((c) => c.id === id);
  const [initial, setInitial] = useState<CampaignDraft | undefined>(isNew ? fresh : undefined);
  useEffect(() => {
    if (!isNew && found !== undefined && initial === undefined)
      setInitial(campaignDraftFrom(found));
  }, [found, initial, isNew]);

  return (
    <>
      <section className="intro">
        <div>
          <a className="crumb" href="#/campaigns">
            <Icon name="back" size={14} />
            کمپین‌ها
          </a>
          <h1>{isNew ? "کمپین تازه" : (found?.name ?? "کمپین")}</h1>
        </div>
      </section>
      {!ready && <p className="loading">در حال خواندن…</p>}
      {ready && !isNew && found === undefined && (
        <div className="card blank">
          <b>این کمپین پیدا نشد</b>
          <a className="btn ghost" href="#/campaigns">
            برگشت به فهرست
          </a>
        </div>
      )}
      {initial !== undefined && <Body key={initial.id} initial={initial} isNew={isNew} />}
    </>
  );
}
