import { slotById, type Forecast as ForecastData, type Line } from "@dotlife/ads";

import { LIMIT_LABEL, num, pct, PRODUCT_LABEL, toman } from "../data/labels";

/** One campaign's part of each of its places today, as `allocate` works it out. */
export function CampaignForecast({
  forecast,
  campaign,
  dailyBudget,
}: {
  forecast: ForecastData;
  campaign: string;
  dailyBudget: number;
}) {
  const lines: (Line & { rivals: number; sold: number })[] = forecast.places.flatMap((p) =>
    p.lines
      .filter((l) => l.campaign === campaign)
      .map((l) => ({ ...l, rivals: p.lines.length - 1, sold: p.sold })),
  );
  const total = forecast.campaigns.get(campaign);
  if (total === undefined || lines.length === 0)
    return <p className="note">هنوز جایگاهی برای این کمپین انتخاب نشده است.</p>;
  const used = dailyBudget > 0 ? Math.min(1, total.spend / dailyBudget) : 0;
  return (
    <div className="forecast">
      <dl className="facts roomy">
        <div>
          <dt>نمایش در روز</dt>
          <dd>{num(total.impressions)}</dd>
        </div>
        <div>
          <dt>کلیک در روز</dt>
          <dd>{num(total.clicks)}</dd>
        </div>
        <div>
          <dt>خرج روزانه</dt>
          <dd>
            {toman(total.spend)} از {toman(dailyBudget)} تومان
            <span className="meter" aria-hidden="true">
              <i style={{ width: `${String(used * 100)}%` }} />
            </span>
          </dd>
        </div>
      </dl>
      <ul className="lines">
        {lines.map((l) => {
          const slot = slotById(l.slot);
          return (
            <li key={l.slot}>
              <div className="line-head">
                <span className="num">{num(l.slot)}</span>
                <b>{slot?.name}</b>
                <small>{PRODUCT_LABEL[l.product]}</small>
                <strong>{pct(l.share * 100)}</strong>
              </div>
              <span className="meter" aria-hidden="true">
                <i style={{ width: `${String(l.share * 100)}%` }} />
              </span>
              <small className="line-meta">
                {num(l.impressions)} نمایش · {toman(l.spend)} تومان در روز
                {l.rivals > 0 && ` · ${num(l.rivals)} رقیب`}
                {l.limit !== null && ` · محدود به ${LIMIT_LABEL[l.limit]}`}
              </small>
            </li>
          );
        })}
      </ul>
      <p className="note">
        تخمین امروز، بر پایه‌ی بازدید روزانه‌ی هر جایگاه، نرخ کلیک ۱٫۲٪ و دامنه‌ی هدف‌گیری. سهم با
        پیشنهاد قیمت بالا می‌رود و بودجه‌ی روزانه سقف آن است؛ با آمدن شمارنده‌های واقعی دقیق‌تر
        می‌شود.
      </p>
    </div>
  );
}
