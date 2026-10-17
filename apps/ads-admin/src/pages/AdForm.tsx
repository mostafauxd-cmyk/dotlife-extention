import {
  AD_STATUS,
  PRODUCTS,
  SALE_MODELS,
  slotById,
  type Ad,
  type Campaign,
  type Target,
} from "@dotlife/ads";
import { useEffect, useState, type SyntheticEvent } from "react";

import { go, useApp, useCampaigns } from "../context";
import {
  graphemes,
  jalali,
  MODEL_LABEL,
  MODEL_UNIT,
  num,
  PHASE_LABEL,
  PRODUCT_LABEL,
} from "../data/labels";
import { duplicateAd, newAdId } from "../data/logic";
import { adsHash, campaignHash, editHash } from "../data/route";
import {
  blankDraft,
  draftFromAd,
  draftToInput,
  slotForm,
  type Draft,
  type ExtraField,
} from "../data/slotForm";
import { validateAd } from "../data/validate";
import { AdPreview, type PreviewAd } from "../ui/AdPreview";
import { ConfirmDialog } from "../ui/Dialog";
import { ChipSet, Field } from "../ui/Fields";
import { TargetingFields } from "../ui/TargetingFields";
import { Icon } from "../ui/Icon";
import { slides } from "../data/logic";

type SetField = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

/** What the preview draws: the draft as typed, with placeholders where nothing is typed yet. */
function previewOf(d: Draft): PreviewAd {
  const input = draftToInput(d);
  const str = (k: string): string | undefined => {
    const v = input[k];
    return typeof v === "string" ? v : undefined;
  };
  const extra = input["extra"];
  const tint = str("tint");
  const image = str("image");
  return {
    slot: d.slot,
    title: d.title.trim(),
    advertiser: d.advertiser.trim(),
    ...(str("line") === undefined ? {} : { line: str("line") }),
    ...(str("cta") === undefined ? {} : { cta: str("cta") }),
    ...(str("glyph") === undefined ? {} : { glyph: str("glyph") }),
    ...(tint !== undefined && /^#[0-9a-fA-F]{6}$/.test(tint) ? { tint } : {}),
    ...(image?.startsWith("https://") === true ? { image } : {}),
    ...(typeof extra === "object" && extra !== null
      ? { extra: extra as Record<string, string> }
      : {}),
  };
}

function ExtraInput({
  f,
  id,
  value,
  onChange,
}: {
  f: ExtraField;
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  switch (f.kind) {
    case "textarea":
      return (
        <textarea
          id={id}
          rows={5}
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      );
    case "select":
      return (
        <select
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        >
          <option value="">انتخاب کن…</option>
          {f.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "date":
      return (
        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      );
    case "number":
      return (
        <input
          id={id}
          type="text"
          inputMode="decimal"
          dir="ltr"
          value={value}
          placeholder={f.placeholder}
          onChange={(e) => {
            onChange(e.target.value);
          }}
        />
      );
    case "text":
      return (
        <>
          <input
            id={id}
            type="text"
            list={f.suggestions === undefined ? undefined : `${id}-list`}
            value={value}
            placeholder={f.placeholder}
            onChange={(e) => {
              onChange(e.target.value);
            }}
          />
          {f.suggestions !== undefined && (
            <datalist id={`${id}-list`}>
              {f.suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      );
  }
}

function Targeting({
  d,
  setD,
  errors,
}: {
  d: Draft;
  setD: (f: (prev: Draft) => Draft) => void;
  errors: Record<string, string>;
}) {
  const slot = slotById(d.slot);
  return (
    <TargetingFields
      allowed={new Set<Target>(slot?.targets ?? [])}
      value={d}
      errors={errors}
      onChange={(patch) => {
        setD((prev) => ({ ...prev, ...patch }));
      }}
    />
  );
}

function FormBody({
  initial,
  isNew,
  campaigns,
}: {
  initial: Draft;
  isNew: boolean;
  campaigns: readonly Campaign[];
}) {
  const { ads: store, toast } = useApp();
  const [d, setD] = useState<Draft>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = slotForm(d.slot);
  const slot = slotById(d.slot);
  const camp = campaigns.find((c) => c.id === d.campaign);
  const campSlots = camp?.products.flatMap((p) => p.slots) ?? [];

  const set: SetField = (key, value) => {
    setD((prev) => ({ ...prev, [key]: value }));
  };
  const changeCampaign = (id: string): void => {
    const c = campaigns.find((x) => x.id === id);
    const slots = c?.products.flatMap((p) => p.slots) ?? [];
    setD((prev) => ({ ...prev, campaign: id, ...(c === undefined ? {} : { model: c.model }) }));
    const first = slots[0];
    if (c !== undefined && first !== undefined && !slots.includes(d.slot)) changeSlot(first);
  };
  const changeSlot = (n: number): void => {
    const next = slotById(n);
    if (next === undefined) return;
    // what the new slot cannot hold is dropped, so nothing hidden is saved
    const keep = new Set<Target>(next.targets);
    const nf = slotForm(n);
    setD((prev) => ({
      ...prev,
      slot: n,
      model: camp?.model ?? next.model,
      products: prev.products.includes(next.product)
        ? prev.products
        : [next.product, ...prev.products],
      persona: keep.has("persona") ? prev.persona : [],
      city: keep.has("city") ? prev.city : [],
      season: keep.has("season") ? prev.season : [],
      occasion: keep.has("occasion") ? prev.occasion : [],
      keyword: keep.has("keyword") ? prev.keyword : [],
      topic: keep.has("topic") ? prev.topic : [],
      weekend: keep.has("weekend") ? prev.weekend : false,
      extra: Object.fromEntries(
        nf.extra.flatMap((f) => {
          const v = prev.extra[f.key];
          return v === undefined ? [] : [[f.key, v]];
        }),
      ),
    }));
  };

  const result = validateAd(draftToInput(d));
  const errors = !result.ok && submitted ? result.errors : {};
  const errorList = Object.values(errors);

  const save = (e: SyntheticEvent): void => {
    e.preventDefault();
    setSubmitted(true);
    if (!result.ok) {
      toast("چند جای فرم درست نیست؛ زیر هر کادر نوشته شده.");
      // the errors are above; bring them into view
      window.requestAnimationFrame(() => {
        document
          .querySelector(".error-sum")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    store.put(result.ad).then(
      () => {
        toast(isNew ? "تبلیغ ساخته شد." : "تغییرها ذخیره شد.");
        go(
          result.ad.campaign === undefined
            ? adsHash({ slot: result.ad.slot })
            : campaignHash(result.ad.campaign),
        );
      },
      () => {
        toast("ذخیره نشد.");
      },
    );
  };
  const duplicate = (): void => {
    if (!result.ok) {
      setSubmitted(true);
      toast("اول فرم را درست کن.");
      return;
    }
    const copy: Ad = duplicateAd(result.ad, newAdId());
    store.put(copy).then(
      () => {
        toast("کپی به‌عنوان پیش‌نویس ساخته شد.");
        go(editHash(copy.id));
      },
      () => {
        toast("ذخیره نشد.");
      },
    );
  };
  const remove = (): void => {
    store.delete(d.id).then(
      () => {
        toast("تبلیغ حذف شد.");
        go(adsHash({}));
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
              <b>این آگهی هنوز ذخیره نشد</b>
              <ul>
                {errorList.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <section className="card">
          <h2>جایگاه</h2>
          <div className="fields">
            <Field label="کمپین" hint="آگهیِ یک کمپین هدف‌گیری، روزها و قیمتش را از کمپین می‌گیرد.">
              {(id) => (
                <select
                  id={id}
                  value={d.campaign}
                  onChange={(e) => {
                    changeCampaign(e.target.value);
                  }}
                >
                  <option value="">بدون کمپین (آگهی جدا)</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.advertiser}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="این تبلیغ کجا بنشیند؟">
              {(id) => (
                <select
                  id={id}
                  value={d.slot}
                  onChange={(e) => {
                    changeSlot(Number(e.target.value));
                  }}
                >
                  {PRODUCTS.flatMap((p) =>
                    slides(p).map((g) => {
                      const list = g.slots.filter(
                        (s) => camp === undefined || campSlots.includes(s.id),
                      );
                      if (list.length === 0) return null;
                      return (
                        <optgroup key={`${p}-${g.name}`} label={`${PRODUCT_LABEL[p]} · ${g.name}`}>
                          {list.map((s) => (
                            <option key={s.id} value={s.id}>
                              {num(s.id)} · {s.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    }),
                  )}
                </select>
              )}
            </Field>
          </div>
          {slot !== undefined && (
            <p className="note">
              {slot.shape}. سقف: {slot.cap}.
            </p>
          )}
        </section>

        <section className="card">
          <h2>محتوا</h2>
          <div className="fields">
            <Field label="آگهی‌دهنده" error={errors["advertiser"]}>
              {(id) => (
                <input
                  id={id}
                  value={d.advertiser}
                  onChange={(e) => {
                    set("advertiser", e.target.value);
                  }}
                />
              )}
            </Field>
            <Field
              label={form.titleLabel}
              error={errors["title"]}
              hint={`${num(graphemes(d.title).length)} از ${num(form.titleMax)} نویسه`}
            >
              {(id) => (
                <input
                  id={id}
                  value={d.title}
                  onChange={(e) => {
                    set("title", e.target.value);
                  }}
                />
              )}
            </Field>
            {form.lineLabel !== undefined && (
              <Field label={form.lineLabel} error={errors["line"]}>
                {(id) => (
                  <input
                    id={id}
                    value={d.line}
                    onChange={(e) => {
                      set("line", e.target.value);
                    }}
                  />
                )}
              </Field>
            )}
            {form.ctaLabel !== undefined && (
              <Field label={form.ctaLabel} error={errors["cta"]}>
                {(id) => (
                  <input
                    id={id}
                    value={d.cta}
                    placeholder={form.ctaPlaceholder}
                    onChange={(e) => {
                      set("cta", e.target.value);
                    }}
                  />
                )}
              </Field>
            )}
            <Field label="نشانی مقصد" error={errors["url"]} hint="باید با https شروع شود." wide>
              {(id) => (
                <input
                  id={id}
                  dir="ltr"
                  value={d.url}
                  onChange={(e) => {
                    set("url", e.target.value);
                  }}
                />
              )}
            </Field>
            {form.glyph === true && (
              <Field
                label="نماد (یک حرف)"
                error={errors["glyph"]}
                hint="وقتی تصویری نیست، روی رنگ برند می‌نشیند."
              >
                {(id) => (
                  <input
                    id={id}
                    maxLength={3}
                    value={d.glyph}
                    onChange={(e) => {
                      set("glyph", e.target.value);
                    }}
                  />
                )}
              </Field>
            )}
            {form.tint !== undefined && (
              <Field
                label={form.tint === "required" ? "رنگ برند" : "رنگ برند (اختیاری)"}
                error={errors["tint"]}
              >
                {(id) => (
                  <div className="color">
                    <input
                      type="color"
                      aria-label="انتخاب رنگ"
                      value={/^#[0-9a-fA-F]{6}$/.test(d.tint) ? d.tint : "#8c9eff"}
                      onChange={(e) => {
                        set("tint", e.target.value);
                      }}
                    />
                    <input
                      id={id}
                      dir="ltr"
                      placeholder="#D9862B"
                      value={d.tint}
                      onChange={(e) => {
                        set("tint", e.target.value);
                      }}
                    />
                  </div>
                )}
              </Field>
            )}
            {form.image === true && (
              <Field label="نشانی تصویر (اختیاری)" error={errors["image"]} wide>
                {(id) => (
                  <input
                    id={id}
                    dir="ltr"
                    placeholder="https://"
                    value={d.image}
                    onChange={(e) => {
                      set("image", e.target.value);
                    }}
                  />
                )}
              </Field>
            )}
          </div>
        </section>

        {form.extra.length > 0 && (
          <section className="card">
            <h2>ویژه‌ی جایگاه {num(d.slot)}</h2>
            <div className="fields">
              {form.extra.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  hint={f.hint}
                  error={errors[`extra.${f.key}`]}
                  wide={f.kind === "textarea"}
                >
                  {(id) => (
                    <ExtraInput
                      f={f}
                      id={id}
                      value={d.extra[f.key] ?? ""}
                      onChange={(v) => {
                        setD((prev) => ({ ...prev, extra: { ...prev.extra, [f.key]: v } }));
                      }}
                    />
                  )}
                </Field>
              ))}
            </div>
          </section>
        )}

        {camp !== undefined ? (
          <section className="card">
            <h2>از کمپین</h2>
            <p className="note">
              هدف‌گیری، روزها، محصول و قیمتِ این آگهی از کمپین «{camp.name}» می‌آید و سهم نمایشش از
              پیشنهاد قیمت و بودجه‌ی آن. <a href={campaignHash(camp.id)}>دیدن کمپین</a>
            </p>
            <div className="fields">
              <Field label="وضعیت این آگهی" hint="متوقف یا پیش‌نویس یعنی در بسته نمی‌آید.">
                {(id) => (
                  <select
                    id={id}
                    value={d.status}
                    onChange={(e) => {
                      const v = AD_STATUS.find((x) => x === e.target.value);
                      if (v !== undefined) set("status", v);
                    }}
                  >
                    {AD_STATUS.map((x) => (
                      <option key={x} value={x}>
                        {PHASE_LABEL[x]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </section>
        ) : (
          <>
            <section className="card">
              <h2>هدف‌گیری</h2>
              <Targeting d={d} setD={setD} errors={errors} />
              <p className="note">
                فقط از روی این‌هاست؛ هرگز از روی متن یادداشت، کار، تراکنش یا دارایی.
              </p>
            </section>

            <section className="card">
              <h2>زمان و فروش</h2>
              <div className="fields">
                <Field
                  label="محصول"
                  error={errors["products"]}
                  hint="کلاینت‌های کدام محصول می‌توانند این را نشان بدهند."
                  wide
                >
                  {() => (
                    <ChipSet
                      label="محصول"
                      items={PRODUCTS.map((p) => ({ id: p, label: PRODUCT_LABEL[p] }))}
                      value={d.products}
                      onChange={(v) => {
                        set("products", v);
                      }}
                    />
                  )}
                </Field>
                <Field label="وضعیت" error={errors["status"]}>
                  {(id) => (
                    <select
                      id={id}
                      value={d.status}
                      onChange={(e) => {
                        const v = AD_STATUS.find((s) => s === e.target.value);
                        if (v !== undefined) set("status", v);
                      }}
                    >
                      {AD_STATUS.map((s) => (
                        <option key={s} value={s}>
                          {PHASE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field
                  label="وزن"
                  error={errors["weight"]}
                  hint="بین ۱ تا ۱۰۰؛ وقتی چند تبلیغ یک جایگاه را می‌خواهند، سنگین‌تر برنده است."
                >
                  {(id) => (
                    <input
                      id={id}
                      inputMode="numeric"
                      dir="ltr"
                      value={d.weight}
                      onChange={(e) => {
                        set("weight", e.target.value);
                      }}
                    />
                  )}
                </Field>
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
                  hint={d.until === "" ? "خالی یعنی بدون پایان." : jalali(d.until)}
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
                          {slot?.model === m ? " (پیشنهاد جایگاه)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="قیمت" error={errors["price"]} hint={MODEL_UNIT[d.model]}>
                  {(id) => (
                    <input
                      id={id}
                      inputMode="numeric"
                      dir="ltr"
                      value={d.price}
                      onChange={(e) => {
                        set("price", e.target.value);
                      }}
                    />
                  )}
                </Field>
                <Field
                  label="سقف نمایش روزانه"
                  error={errors["dailyCap"]}
                  hint="خالی یعنی بدون سقف؛ رسیدن به سقف، تبلیغ را از بسته‌ی بعدی بیرون می‌گذارد."
                >
                  {(id) => (
                    <input
                      id={id}
                      inputMode="numeric"
                      dir="ltr"
                      value={d.dailyCap}
                      onChange={(e) => {
                        set("dailyCap", e.target.value);
                      }}
                    />
                  )}
                </Field>
              </div>
            </section>
          </>
        )}

        <div className="form-actions">
          <button type="submit" className="btn">
            <Icon name="check" size={17} />
            ذخیره
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              go(adsHash({}));
            }}
          >
            انصراف
          </button>
          {!isNew && (
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
          <h2>پیش‌نمایش زنده</h2>
          <AdPreview ad={previewOf(d)} />
          <p className="note">
            یک نمونه‌ی فشرده از جعبه‌ی واقعی؛ کلاینت‌ها با اجزای خودشان می‌کشند.
          </p>
        </div>
      </aside>

      {confirmDelete && (
        <ConfirmDialog
          title="حذف تبلیغ"
          message={`«${d.title}» برای همیشه حذف می‌شود.`}
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

export function AdForm({
  id,
  slot,
  campaign,
}: {
  id: string;
  slot: number | undefined;
  campaign: string | undefined;
}) {
  const { ads: store } = useApp();
  const { campaigns, ready } = useCampaigns();
  const isNew = id === "new";
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "missing" } | { kind: "ready"; draft: Draft }
  >(
    isNew
      ? { kind: "ready", draft: blankDraft(slot ?? 1, newAdId(), campaign ?? "") }
      : { kind: "loading" },
  );

  useEffect(() => {
    if (isNew) return;
    let live = true;
    void store.get(id).then((ad) => {
      if (live)
        setState(
          ad === undefined ? { kind: "missing" } : { kind: "ready", draft: draftFromAd(ad) },
        );
    });
    return () => {
      live = false;
    };
  }, [id, isNew, store]);

  return (
    <>
      <section className="intro">
        <div>
          <a className="crumb" href={adsHash({})}>
            <Icon name="back" size={14} />
            آگهی‌ها
          </a>
          <h1>{isNew ? "آگهی تازه" : "ویرایش آگهی"}</h1>
        </div>
      </section>
      {state.kind === "loading" && <p className="loading">در حال خواندن…</p>}
      {state.kind === "missing" && (
        <div className="card blank">
          <b>این تبلیغ پیدا نشد</b>
          <a className="btn ghost" href={adsHash({})}>
            برگشت به فهرست
          </a>
        </div>
      )}
      {state.kind === "ready" && ready && (
        <FormBody key={state.draft.id} initial={state.draft} isNew={isNew} campaigns={campaigns} />
      )}
    </>
  );
}
