import {
  allocate,
  MAX_PER_SLIDE,
  placementsOf,
  PRODUCT_INFO,
  PRODUCTS,
  type Ad,
  type PlaceForecast,
  type Product,
  type Slot,
} from "@dotlife/ads";
import { useState } from "react";

import { go, useAds, useCampaigns } from "../context";
import { jalali, MODEL_LABEL, num, pct, PRODUCT_LABEL, TARGET_LABEL } from "../data/labels";
import {
  campaignMap,
  overfilled,
  slideFilled,
  slides,
  slotFill,
  type Campaigns,
  type SlotFill,
} from "../data/logic";
import { adsHash, newAdHash } from "../data/route";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/Tabs";

const FILL_LABEL: Record<SlotFill["kind"], string> = {
  live: "زنده",
  scheduled: "زمان‌بندی‌شده",
  house: "معرفی خود",
  empty: "خالی",
};

function FillLine({ fill, ad }: { fill: SlotFill; ad: Ad | undefined }) {
  switch (fill.kind) {
    case "live":
      return (
        <p className="fill-line">
          <b>{ad?.title}</b>
          <small>
            {ad?.advertiser}
            {fill.live > 1 && ` · و ${num(fill.live - 1)} تبلیغ زنده‌ی دیگر`}
          </small>
        </p>
      );
    case "scheduled":
      return (
        <p className="fill-line">
          <b>{ad?.title}</b>
          <small>
            {ad?.from === undefined ? "به‌زودی" : `از ${jalali(ad.from)}`} · {ad?.advertiser}
          </small>
        </p>
      );
    case "house":
      return (
        <p className="fill-line">
          <b>معرفی خود نقطه و پاکت</b>
          <small>
            تبلیغ فروخته‌شده‌ای نیست
            {fill.scheduled > 0 && `؛ ${num(fill.scheduled)} تبلیغ در راه است`}
          </small>
        </p>
      );
    case "empty":
      return (
        <p className="fill-line">
          <b className="dim">خالی</b>
          <small>فروخته نشده؛ جای خالی می‌ماند و تبلیغ پرکننده‌ای نمی‌آید.</small>
        </p>
      );
  }
}

function SlotCard({
  slot,
  ads,
  now,
  campaigns,
  place,
}: {
  slot: Slot;
  ads: readonly Ad[];
  now: Date;
  campaigns: Campaigns;
  place: PlaceForecast | undefined;
}) {
  const fill = slotFill(slot, ads, now, campaigns);
  const total = ads.filter((a) => a.slot === slot.id).length;
  return (
    <article className={`slot-card ${fill.kind}`}>
      <header>
        <span className="num">{num(slot.id)}</span>
        <h3>{slot.name}</h3>
        <span className={`badge ${fill.kind}`}>{FILL_LABEL[fill.kind]}</span>
      </header>
      <p className="shape">{slot.shape}</p>
      <dl className="facts">
        <div>
          <dt>سقف</dt>
          <dd>{slot.cap}</dd>
        </div>
        <div>
          <dt>هدف‌گیری</dt>
          <dd>
            {slot.targets.length === 0
              ? "همه"
              : slot.targets.map((t) => (
                  <span key={t} className="mini-chip">
                    {TARGET_LABEL[t]}
                  </span>
                ))}
          </dd>
        </div>
        <div>
          <dt>مدل فروش</dt>
          <dd>{MODEL_LABEL[slot.model]}</dd>
        </div>
      </dl>
      <FillLine fill={fill} ad={fill.ad} />
      {place !== undefined && place.lines.length > 0 && (
        <div className="sold">
          <span>
            {pct(place.sold * 100)} فروخته‌شده امروز · {num(place.lines.length)} کمپین
          </span>
          <span className="meter" aria-hidden="true">
            <i style={{ width: `${String(place.sold * 100)}%` }} />
          </span>
        </div>
      )}
      <footer>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => {
            go(adsHash({ slot: slot.id }));
          }}
        >
          آگهی‌ها ({num(total)})
        </button>
        <button
          type="button"
          className="btn sm"
          onClick={() => {
            go(newAdHash(slot.id));
          }}
        >
          <Icon name="plus" size={15} />
          آگهی تازه
        </button>
      </footer>
    </article>
  );
}

export function Slots() {
  const { ads, ready } = useAds();
  const { campaigns } = useCampaigns();
  const [product, setProduct] = useState<Product>("newtab");
  const now = new Date();
  const map = campaignMap(campaigns);
  const forecast = allocate(campaigns, now);
  const groups = slides(product);
  const counts = { live: 0, scheduled: 0, house: 0, empty: 0 };
  for (const g of groups) for (const s of g.slots) counts[slotFill(s, ads, now, map).kind]++;
  return (
    <>
      <section className="intro">
        <div>
          <h1>جایگاه‌های تبلیغ</h1>
          <p>
            {num(placementsOf(product).length)} جایگاه در {PRODUCT_INFO[product].name} (
            {PRODUCT_INFO[product].platform}). همه بومی‌اند: شکل و اندازه‌ی همان چیزی را دارند که
            کنارش نشسته‌اند و فقط برچسب «معرفی‌شده» فرقشان را نشان می‌دهد. جایگاه فروخته‌نشده خالی
            می‌ماند یا با معرفی خود نقطه و پاکت پر می‌شود، هیچ‌وقت با تبلیغ پرکننده‌ی شبکه‌ای.
          </p>
          <div className="summary" aria-label="خلاصه‌ی جایگاه‌ها">
            {(["live", "scheduled", "house", "empty"] as const).map((k) => (
              <span key={k} className={`badge ${k}`}>
                {FILL_LABEL[k]} · {num(counts[k])}
              </span>
            ))}
          </div>
        </div>
      </section>
      <div className="switches">
        <Tabs<Product>
          label="محصول"
          value={product}
          onChange={setProduct}
          items={PRODUCTS.map((p) => ({
            id: p,
            label: PRODUCT_LABEL[p],
            count: num(placementsOf(p).length),
          }))}
        />
      </div>
      <ul className="rules">
        {product === "newtab" && (
          <li>در نمای اول فقط ردیف معرفی‌شده‌ی پیشنهاد سرچ (۴) و تم روز (۳) دیده می‌شوند.</li>
        )}
        {product === "paket" && (
          <li>
            مشترک پاکت پلاس هیچ تبلیغی نمی‌بیند؛ هیچ جایگاهی کنار موجودی، تراکنش یا بودجه نیست.
          </li>
        )}
        {product === "noghte" && (
          <li>هیچ جایگاهی داخل یادداشت‌ها، کارها یا جدول برنامه‌ها نیست.</li>
        )}
        <li>
          هیچ تبلیغی داخل محتوای کاربر نمی‌آید و هدف‌گیری فقط با پرسونا، شهر، فصل، مناسبت، موضوع و
          کلمه‌ی سرچ است.
        </li>
        {product === "newtab" && (
          <li>در هر اسلاید حداکثر {num(MAX_PER_SLIDE)} جایگاه با هم پر می‌شوند.</li>
        )}
      </ul>
      {!ready && <p className="loading">در حال خواندن…</p>}
      {groups.map((g, i) => {
        const filled = slideFilled(g, ads, now, map);
        return (
          <section key={g.name} className="slide-group">
            <h2>
              <span>{product === "newtab" ? `اسلاید ${num(i + 1)} · ${g.name}` : g.name}</span>
              <small className={product === "newtab" && overfilled(filled) ? "warn" : undefined}>
                {num(filled)} از {num(g.slots.length)} جایگاه زنده
                {product === "newtab" &&
                  overfilled(filled) &&
                  ` — فقط ${num(MAX_PER_SLIDE)} تا با هم نمایش داده می‌شوند`}
              </small>
            </h2>
            <div className="slot-grid">
              {g.slots.map((s) => (
                <SlotCard
                  key={s.id}
                  slot={s}
                  ads={ads}
                  now={now}
                  campaigns={map}
                  place={forecast.places.find((p) => p.slot === s.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
