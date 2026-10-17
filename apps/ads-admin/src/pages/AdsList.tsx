import { SLOTS, slotById, type Ad } from "@dotlife/ads";
import { useState } from "react";

import { go, useApp, useAds } from "../context";
import {
  firstLetter,
  jalali,
  MODEL_LABEL,
  num,
  PHASE_LABEL,
  PRODUCT_LABEL,
  type Phase,
} from "../data/labels";
import {
  adPhase,
  advertisers,
  duplicateAd,
  filterAds,
  newAdId,
  pauseAds,
  resumeAds,
  type AdFilter,
} from "../data/logic";
import { adsHash, editHash, newAdHash } from "../data/route";
import { AdPreview } from "../ui/AdPreview";
import { ConfirmDialog, Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/Tabs";

const PHASES: readonly Phase[] = ["live", "scheduled", "paused", "draft", "ended"];

function Schedule({ ad }: { ad: Ad }) {
  if (ad.from === undefined && ad.until === undefined) return <small>بدون محدودیت روز</small>;
  return (
    <small>
      {ad.from === undefined ? "از همین حالا" : `از ${jalali(ad.from)}`}
      {ad.until !== undefined && ` تا ${jalali(ad.until)}`}
    </small>
  );
}

export function AdsList({ filter }: { filter: AdFilter }) {
  const { ads: store, toast } = useApp();
  const { ads, ready } = useAds();
  const now = new Date();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [toDelete, setToDelete] = useState<Ad | undefined>();
  const [toPreview, setToPreview] = useState<Ad | undefined>();

  // the phase tabs count what the other filters leave, so the numbers match what a tab would show
  const withoutPhase = filterAds(ads, { ...filter, phase: undefined }, now);
  const shown =
    filter.phase === undefined
      ? withoutPhase
      : withoutPhase.filter((a) => adPhase(a, now) === filter.phase);
  const phaseCount = (p: Phase): number => withoutPhase.filter((a) => adPhase(a, now) === p).length;

  const set = (patch: Partial<AdFilter>): void => {
    go(adsHash({ ...filter, ...patch }), true);
  };
  const filtered =
    filter.slot !== undefined ||
    filter.phase !== undefined ||
    filter.product !== undefined ||
    filter.advertiser !== undefined ||
    (filter.q ?? "") !== "";

  const picked = shown.filter((a) => selected.has(a.id));
  const allOn = shown.length > 0 && picked.length === shown.length;
  const toggle = (id: string): void => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

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
  const pauseSelected = (): void => {
    const ids = new Set(picked.map((a) => a.id));
    const changed = pauseAds(ads, ids);
    if (changed.length === 0) toast("تبلیغِ زنده یا زمان‌بندی‌شده‌ای بین انتخاب‌ها نبود.");
    else run(store.putMany(changed), `${num(changed.length)} تبلیغ متوقف شد.`);
  };
  const resumeSelected = (): void => {
    const ids = new Set(picked.map((a) => a.id));
    const changed = resumeAds(ads, ids);
    if (changed.length === 0) toast("تبلیغِ متوقفی بین انتخاب‌ها نبود.");
    else run(store.putMany(changed), `${num(changed.length)} تبلیغ ادامه یافت.`);
  };
  const duplicate = (ad: Ad): void => {
    const copy = duplicateAd(ad, newAdId());
    run(store.put(copy), "کپی به‌عنوان پیش‌نویس ساخته شد.");
  };
  const remove = (ad: Ad): void => {
    setToDelete(undefined);
    setSelected((s) => {
      const next = new Set(s);
      next.delete(ad.id);
      return next;
    });
    run(store.delete(ad.id), "تبلیغ حذف شد.");
  };

  return (
    <>
      <section className="intro">
        <div>
          <h1>تبلیغ‌ها</h1>
          <p>
            همه‌ی تبلیغ‌ها در یک فهرست. با فیلتر جایگاه، وضعیت، محصول و آگهی‌دهنده، یا جستجوی عنوان.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            go(newAdHash(filter.slot));
          }}
        >
          <Icon name="plus" size={17} />
          تبلیغ تازه
        </button>
      </section>

      <section className="card filters">
        <div className="search">
          <Icon name="search" size={17} />
          <input
            type="search"
            aria-label="جستجو در تبلیغ‌ها"
            placeholder="جستجوی عنوان، آگهی‌دهنده، کلمه…"
            value={filter.q ?? ""}
            onChange={(e) => {
              set({ q: e.target.value });
            }}
          />
        </div>
        <label className="sel">
          <span>جایگاه</span>
          <select
            value={filter.slot ?? ""}
            onChange={(e) => {
              set({ slot: e.target.value === "" ? undefined : Number(e.target.value) });
            }}
          >
            <option value="">همه</option>
            {SLOTS.map((s) => (
              <option key={s.id} value={s.id}>
                {num(s.id)} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="sel">
          <span>محصول</span>
          <select
            value={filter.product ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              set({ product: v === "newtab" || v === "noghte" || v === "paket" ? v : undefined });
            }}
          >
            <option value="">همه</option>
            {(Object.keys(PRODUCT_LABEL) as (keyof typeof PRODUCT_LABEL)[]).map((p) => (
              <option key={p} value={p}>
                {PRODUCT_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="sel">
          <span>آگهی‌دهنده</span>
          <select
            value={filter.advertiser ?? ""}
            onChange={(e) => {
              set({ advertiser: e.target.value === "" ? undefined : e.target.value });
            }}
          >
            <option value="">همه</option>
            {advertisers(ads).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              go("#/ads", true);
            }}
          >
            پاک کردن فیلتر
          </button>
        )}
        <div className="phase-tabs">
          <Tabs<Phase | "all">
            size="sm"
            label="وضعیت"
            value={filter.phase ?? "all"}
            onChange={(p) => {
              set({ phase: p === "all" ? undefined : p });
            }}
            items={[
              { id: "all", label: "همه", count: num(withoutPhase.length) },
              ...PHASES.map((p) => ({ id: p, label: PHASE_LABEL[p], count: num(phaseCount(p)) })),
            ]}
          />
        </div>
      </section>

      {picked.length > 0 && (
        <div className="bulk" role="region" aria-label="کار روی انتخاب‌ها">
          <b>{num(picked.length)} تبلیغ انتخاب شد</b>
          <button type="button" className="btn sm" onClick={pauseSelected}>
            <Icon name="pause" size={15} />
            توقف
          </button>
          <button type="button" className="btn sm" onClick={resumeSelected}>
            <Icon name="play" size={15} />
            ادامه
          </button>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              setSelected(new Set());
            }}
          >
            برداشتن انتخاب
          </button>
        </div>
      )}

      <section className="card list">
        {shown.length > 0 && (
          <div className="ad-head" aria-hidden={false}>
            <label className="check">
              <input
                type="checkbox"
                aria-label="انتخاب همه"
                checked={allOn}
                onChange={() => {
                  setSelected(allOn ? new Set() : new Set(shown.map((a) => a.id)));
                }}
              />
            </label>
            <span />
            <span>تبلیغ</span>
            <span>جایگاه</span>
            <span>محصول</span>
            <span>وضعیت و روزها</span>
            <span>وزن</span>
            <span>مدل فروش</span>
            <span />
          </div>
        )}
        {shown.map((ad) => {
          const phase = adPhase(ad, now);
          const slot = slotById(ad.slot);
          const tint = ad.tint ?? "#8c9eff";
          return (
            <div key={ad.id} className={selected.has(ad.id) ? "ad-row on" : "ad-row"}>
              <label className="check">
                <input
                  type="checkbox"
                  aria-label={`انتخاب ${ad.title}`}
                  checked={selected.has(ad.id)}
                  onChange={() => {
                    toggle(ad.id);
                  }}
                />
              </label>
              <i
                className="mark"
                style={{
                  background: `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 55%, #000))`,
                }}
              >
                {ad.glyph ?? firstLetter(ad.title)}
              </i>
              <button
                type="button"
                className="ad-title"
                onClick={() => {
                  go(editHash(ad.id));
                }}
              >
                <b>{ad.title}</b>
                <small>
                  {ad.advertiser}
                  {ad.line !== undefined && ` · ${ad.line}`}
                </small>
              </button>
              <span className="ad-slot">
                <span className="num">{num(ad.slot)}</span>
                {slot?.name}
              </span>
              <span className="ad-products">
                {ad.products.map((p) => (
                  <span key={p} className="mini-chip">
                    {PRODUCT_LABEL[p]}
                  </span>
                ))}
              </span>
              <span className="ad-phase">
                <span className={`badge ${phase}`}>{PHASE_LABEL[phase]}</span>
                <Schedule ad={ad} />
              </span>
              <span className="ad-weight">{num(ad.weight)}</span>
              <span className="ad-model">{MODEL_LABEL[ad.model]}</span>
              <span className="row-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="پیش‌نمایش"
                  aria-label={`پیش‌نمایش ${ad.title}`}
                  onClick={() => {
                    setToPreview(ad);
                  }}
                >
                  <Icon name="eye" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="ویرایش"
                  aria-label={`ویرایش ${ad.title}`}
                  onClick={() => {
                    go(editHash(ad.id));
                  }}
                >
                  <Icon name="edit" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="کپی"
                  aria-label={`کپی ${ad.title}`}
                  onClick={() => {
                    duplicate(ad);
                  }}
                >
                  <Icon name="copy" />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="حذف"
                  aria-label={`حذف ${ad.title}`}
                  onClick={() => {
                    setToDelete(ad);
                  }}
                >
                  <Icon name="trash" />
                </button>
              </span>
            </div>
          );
        })}
        {shown.length === 0 && ready && (
          <div className="blank">
            {ads.length === 0 ? (
              <>
                <b>هنوز تبلیغی نیست</b>
                <p>از یک جایگاه شروع کن و اولین تبلیغ را بساز.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    go(newAdHash());
                  }}
                >
                  <Icon name="plus" size={17} />
                  تبلیغ تازه
                </button>
              </>
            ) : (
              <>
                <b>تبلیغی با این فیلتر پیدا نشد</b>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    go("#/ads", true);
                  }}
                >
                  پاک کردن فیلتر
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {toDelete !== undefined && (
        <ConfirmDialog
          title="حذف تبلیغ"
          message={
            <>
              «{toDelete.title}» برای همیشه حذف می‌شود. اگر فقط می‌خواهی نمایش داده نشود، به‌جای حذف
              آن را متوقف کن.
            </>
          }
          confirm="حذف"
          onConfirm={() => {
            remove(toDelete);
          }}
          onClose={() => {
            setToDelete(undefined);
          }}
        />
      )}
      {toPreview !== undefined && (
        <Dialog
          title={`پیش‌نمایش «${toPreview.title}»`}
          onClose={() => {
            setToPreview(undefined);
          }}
          actions={
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setToPreview(undefined);
              }}
            >
              بستن
            </button>
          }
        >
          <AdPreview ad={toPreview} />
        </Dialog>
      )}
    </>
  );
}
