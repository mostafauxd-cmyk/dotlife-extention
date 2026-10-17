import type { CSSProperties, ReactNode } from "react";
import type { Ad } from "@dotlife/ads";
import { PRODUCT_INFO, slotById } from "@dotlife/ads";

import { firstLetter, num } from "../data/labels";
import { Icon } from "./Icon";

/**
 * A compact mock of the real box an ad sits in, drawn from the same few fields a client uses, with
 * its neighbours dimmed beside it and the «معرفی‌شده» label. Shapes follow the design's slots
 * (design/prototypes/newtab.html); the clients draw them in their own components.
 */

export type PreviewAd = Pick<Ad, "slot" | "title" | "advertiser"> &
  Partial<Pick<Ad, "line" | "cta" | "glyph" | "tint" | "image" | "extra">>;

const LABEL = "معرفی‌شده";
const FALLBACK_TINT = "#8c9eff";

const Tag = () => <span className="pv-tag">{LABEL}</span>;

/** The round or square mark: a picture when there is one, else a glyph on the brand colour. */
function Mark({ ad, shape = "round" }: { ad: PreviewAd; shape?: "round" | "square" }) {
  const tint = ad.tint ?? FALLBACK_TINT;
  const style = {
    background: `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 55%, #000))`,
  } satisfies CSSProperties;
  return (
    <i className={shape === "square" ? "pv-mark sq" : "pv-mark"} style={style}>
      {ad.image !== undefined ? (
        <img src={ad.image} alt="" onError={(e) => (e.currentTarget.hidden = true)} />
      ) : (
        (ad.glyph ?? firstLetter(ad.title))
      )}
    </i>
  );
}

const Ghost = ({ children = "" }: { children?: ReactNode }) => (
  <span className="pv-ghost">{children}</span>
);

function Tile({ label, ad, own }: { label: string; ad?: PreviewAd; own?: boolean }) {
  return (
    <span className={own === true ? "pv-tile own" : "pv-tile"}>
      {ad === undefined ? (
        <i className="pv-mark ghost">{firstLetter(label)}</i>
      ) : (
        <Mark ad={ad} shape="square" />
      )}
      <b>{label}</b>
      {own === true && <em className="pv-dot" />}
    </span>
  );
}

function priceChange(raw: string | undefined): { text: string; up: boolean } | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return { text: `${n >= 0 ? "▲" : "▼"} ${num(Math.abs(n))}٪`, up: n >= 0 };
}

function Mock({ ad }: { ad: PreviewAd }) {
  const tint = ad.tint ?? FALLBACK_TINT;
  const title = ad.title === "" ? "عنوان تبلیغ" : ad.title;
  const line = ad.line;
  const cta = ad.cta;
  switch (ad.slot) {
    case 1:
      return (
        <div className="pv-tiles">
          <Tile label="یوتیوب" />
          <Tile label="جیمیل" />
          <Tile label="دیجی‌کالا" />
          <Tile label={title} ad={ad} own />
        </div>
      );
    case 2:
      return (
        <div className="pv-folder">
          <b>{ad.extra?.["folder"] ?? "پوشه"}</b>
          <div className="pv-tiles">
            <Tile label="فیگما" />
            <Tile label="دریبل" />
            <span className="pv-tile own">
              <Mark ad={ad} shape="square" />
              <b>{title}</b>
              <Tag />
            </span>
          </div>
        </div>
      );
    case 3:
      return (
        <div
          className="pv-wall"
          style={{
            background: `radial-gradient(120% 90% at 50% 30%, color-mix(in srgb, ${tint} 38%, transparent), transparent 70%), #171a22`,
          }}
        >
          <span className="pv-bigdot" style={{ background: tint }} />
          <span className="pv-search" />
          <span className="pv-credit">
            {line ?? `تم امروز: کمپین «${title}»`} · {LABEL}
          </span>
        </div>
      );
    case 4:
      return (
        <div className="pv-list">
          <div className="pv-row">
            <Icon name="search" size={14} />
            <Ghost>بلیت هواپیما</Ghost>
          </div>
          <div className="pv-row own">
            <Icon name="star" size={14} />
            <span>{title}</span>
            <Tag />
          </div>
          <div className="pv-row">
            <Icon name="search" size={14} />
            <Ghost>بلیت قطار</Ghost>
          </div>
        </div>
      );
    case 5:
      return (
        <div className="pv-card">
          <small>امروز · ۲۵ مهر</small>
          <b>روز ملی کتاب‌خوانی</b>
          <span className="pv-line">
            {title}
            <Tag />
          </span>
        </div>
      );
    case 6:
      return (
        <div className="pv-edge">
          <span className="pv-rail" />
          <div className="pv-card own">
            <b>{title}</b>
            {line !== undefined && <span className="pv-sub">{line}</span>}
            <span className="pv-foot">
              <Tag />
              <button type="button" className="pv-btn" tabIndex={-1}>
                {cta ?? "ببین"}
              </button>
            </span>
          </div>
        </div>
      );
    case 7:
    case 15: {
      const seven = ad.slot === 7;
      return (
        <div className="pv-ev">
          <div className="pv-event own">
            <span
              className="pv-pst"
              style={{
                background: `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 55%, #000))`,
              }}
            >
              {seven ? (ad.extra?.["kind"] ?? "رویداد") : "کانال"}
            </span>
            <div>
              <b>{title}</b>
              <span>
                {line === undefined ? "" : `${line} · `}
                {LABEL}
              </span>
            </div>
            <button type="button" tabIndex={-1}>
              {cta ?? (seven ? "+ برنامه" : "عضویت")}
            </button>
          </div>
          <Ghost>{seven ? "رویدادهای شهر" : "قاب تلگرام"}</Ghost>
        </div>
      );
    }
    case 8:
      return (
        <div className="pv-list">
          <div className="pv-row">
            <span className="pv-day">{num(24)}</span>
            <Ghost>روز ملی کتاب</Ghost>
          </div>
          <div className="pv-row">
            <span className="pv-day">{num(Number(ad.extra?.["occasionDay"] ?? 26))}</span>
            <Ghost>روز ورزش</Ghost>
          </div>
          <div className="pv-row sub own">
            <span>{title}</span>
            <Tag />
          </div>
        </div>
      );
    case 9:
      return (
        <div className="pv-list">
          <div className="pv-row">
            <Ghost>تقویم ملی</Ghost>
          </div>
          <div className="pv-row">
            <Ghost>یادآور دارو</Ghost>
          </div>
          <div className="pv-row own">
            <i className="pv-sdot" />
            <span>{title}</span>
            <Tag />
          </div>
        </div>
      );
    case 10:
      return (
        <div className="pv-ticker">
          <span>
            <Ghost>بیت‌کوین</Ghost>
          </span>
          <span className="pv-tk own">
            <b>{title}</b>
            {line}
            <Tag />
          </span>
          <span>
            <Ghost>اتریوم</Ghost>
          </span>
        </div>
      );
    case 11: {
      const change = priceChange(ad.extra?.["change"]);
      const price = Number(ad.extra?.["price"]);
      return (
        <div className="pv-list">
          <div className="pv-row">
            <Ghost>طلای ۱۸ عیار</Ghost>
            <b className="pv-price">{num(26_227_000)}</b>
          </div>
          <div className="pv-row own price">
            <Mark ad={ad} />
            <span className="pv-nm">
              <b>
                {title}
                <Tag />
              </b>
              {line !== undefined && <small>{line}</small>}
            </span>
            <span className="pv-pv">
              <b>{Number.isFinite(price) && price > 0 ? num(price) : "—"}</b>
              {change !== undefined && (
                <small className={change.up ? "up" : "dn"}>{change.text}</small>
              )}
            </span>
          </div>
          <div className="pv-row">
            <Ghost>سکه‌ی امامی</Ghost>
            <b className="pv-price">{num(274_500_000)}</b>
          </div>
        </div>
      );
    }
    case 12:
      return (
        <div className="pv-news">
          <div className="pv-ncard">
            <Ghost>خبر ۱</Ghost>
          </div>
          <div className="pv-ncard dashed own">
            <span className="pv-kind">{LABEL}</span>
            <b>{title}</b>
            <span className="pv-foot">
              <small>{line ?? ""}</small>
              <small>{cta === undefined ? "" : `${cta} ←`}</small>
            </span>
          </div>
        </div>
      );
    case 13: {
      const body = (ad.extra?.["body"] ?? "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "");
      return (
        <div className="pv-notes">
          <div className="pv-folders">
            <Ghost>همه‌ی یادداشت‌ها</Ghost>
            <Ghost>کتاب‌ها</Ghost>
          </div>
          <div className="pv-card own tpl">
            <small>قالب پیشنهادی</small>
            <b>{title}</b>
            <span className="pv-sub">
              {line}
              {line !== undefined && " "}
              <Tag />
            </span>
            {body.length > 0 && (
              <ul>
                {body.slice(0, 3).map((l, i) => (
                  <li key={`${String(i)}-${l}`}>{l}</li>
                ))}
              </ul>
            )}
            <button type="button" className="pv-btn" tabIndex={-1}>
              {cta ?? "استفاده از قالب"}
            </button>
          </div>
        </div>
      );
    }
    case 14:
      return (
        <div className="pv-feed">
          <div className="pv-frow">
            <Ghost>خبر ۳</Ghost>
          </div>
          <div className="pv-frow dashed own">
            <Mark ad={ad} shape="square" />
            <span className="pv-tx">
              <span className="pv-meta">
                <span className="pv-kind">{LABEL}</span>
                {ad.advertiser}
              </span>
              <b>{title}</b>
              {line !== undefined && <small>{line}</small>}
            </span>
          </div>
        </div>
      );
    // Noghte's phone app
    case 101:
    case 102:
      return (
        <div className="pv-phone">
          {ad.slot === 102 && <div className="pv-box ghost">آب‌وهوا · ۱۸°</div>}
          <div className="pv-box own">
            <span className="pv-boxhead">
              {ad.glyph !== undefined || ad.image !== undefined ? <Mark ad={ad} /> : null}
              <b>{title}</b>
              <Tag />
            </span>
            {line !== undefined && <span className="pv-sub">{line}</span>}
            {cta !== undefined && (
              <button type="button" className="pv-btn" tabIndex={-1}>
                {cta}
              </button>
            )}
          </div>
          {ad.slot === 101 && <div className="pv-box ghost">رویدادهای امروز</div>}
        </div>
      );
    case 103:
      return (
        <div className="pv-phone">
          <div className="pv-list">
            <div className="pv-row">
              <span className="pv-day">{num(25)}</span>
              <Ghost>روز ملی کتاب‌خوانی</Ghost>
            </div>
            <div className="pv-row sub own">
              <span>{title}</span>
              <Tag />
            </div>
            <div className="pv-row">
              <span className="pv-day">{num(29)}</span>
              <Ghost>روز صادرات</Ghost>
            </div>
          </div>
        </div>
      );
    case 104:
      return (
        <div className="pv-phone">
          <div className="pv-box">
            <small>رویدادهای امروز</small>
            <div className="pv-list">
              <div className="pv-row">
                <Ghost>زادروز سعدی</Ghost>
              </div>
              <div className="pv-row own">
                <i className="pv-sdot" />
                <span>{title}</span>
                <Tag />
              </div>
            </div>
            {line !== undefined && <span className="pv-sub">{line}</span>}
          </div>
        </div>
      );
    case 105:
      return (
        <div className="pv-phone">
          <div className="pv-forecast">
            {["ش", "ی", "د", "س", "چ"].map((d, i) => (
              <span key={d}>
                {d}
                <b>{num(18 - i)}°</b>
              </span>
            ))}
          </div>
          <div className="pv-event own">
            <Mark ad={ad} />
            <div>
              <b>{title}</b>
              <span>
                {line === undefined ? "" : `${line} · `}
                {LABEL}
              </span>
            </div>
            <button type="button" tabIndex={-1}>
              {cta ?? "ببین"}
            </button>
          </div>
        </div>
      );
    case 106:
    case 206:
      return (
        <div className="pv-phone">
          <div className="pv-list">
            <div className="pv-row">
              <Ghost>{ad.slot === 106 ? "شهر و اوقات شرعی" : "اشتراک پلاس"}</Ghost>
            </div>
            <div className="pv-row own price">
              <Mark ad={ad} />
              <span className="pv-nm">
                <b>
                  {title}
                  <Tag />
                </b>
                {line !== undefined && <small>{line}</small>}
              </span>
              <button type="button" className="pv-btn" tabIndex={-1}>
                {cta ?? "عضویت"}
              </button>
            </div>
            <div className="pv-row">
              <Ghost>پشتیبانی</Ghost>
            </div>
          </div>
        </div>
      );
    // Paket's phone app
    case 201:
      return (
        <div className="pv-phone">
          <div className="pv-news">
            <div className="pv-ncard">
              <span className="pv-kind info">اطلاعیه</span>
              <Ghost>قطعی برنامه‌ریزی‌شده‌ی پرداخت کارتی</Ghost>
            </div>
            <div className="pv-ncard dashed own">
              <span className="pv-kind">{LABEL}</span>
              <b>{title}</b>
              <span className="pv-foot">
                <small>{line ?? ""}</small>
                <small>{cta === undefined ? "" : `${cta} ←`}</small>
              </span>
            </div>
          </div>
        </div>
      );
    case 202:
      return (
        <div className="pv-phone">
          <div className="pv-halves">
            <div className="pv-box ghost">دسته‌های پرخرج</div>
            <div className="pv-box own tile">
              <Mark ad={ad} shape="square" />
              <b>{title}</b>
              <Tag />
            </div>
          </div>
        </div>
      );
    case 203:
    case 204:
    case 205:
      return (
        <div className="pv-phone">
          <div className="pv-list">
            <div className="pv-row">
              <Ghost>
                {ad.slot === 203
                  ? "خوراک"
                  : ad.slot === 204
                    ? "قبض برق · یکشنبه"
                    : "پیش‌بینی پایان ماه"}
              </Ghost>
            </div>
            <div className="pv-row">
              <Ghost>
                {ad.slot === 203 ? "حمل‌ونقل" : ad.slot === 204 ? "اجاره · ۱ آبان" : "سقف بودجه"}
              </Ghost>
            </div>
          </div>
          <div className="pv-box own">
            <span className="pv-boxhead">
              <b>{title}</b>
              <Tag />
            </span>
            {line !== undefined && <span className="pv-sub">{line}</span>}
            {cta !== undefined && (
              <button type="button" className="pv-btn" tabIndex={-1}>
                {cta}
              </button>
            )}
          </div>
        </div>
      );
    default:
      return <Ghost>{title}</Ghost>;
  }
}

/** The ad in its slot, on a dark card like the new tab's own. */
export function AdPreview({ ad }: { ad: PreviewAd }) {
  const slot = slotById(ad.slot);
  return (
    <figure className="pv">
      <figcaption>
        <span className="num">{num(ad.slot)}</span>
        {slot?.name ?? "جایگاه"}
        <small>
          {slot === undefined ? "" : `${PRODUCT_INFO[slot.product].name} · ${slot.slide}`}
        </small>
      </figcaption>
      <div className="pv-stage">
        <Mock ad={ad} />
      </div>
      {slot !== undefined && <p className="pv-shape">{slot.shape}</p>}
    </figure>
  );
}
