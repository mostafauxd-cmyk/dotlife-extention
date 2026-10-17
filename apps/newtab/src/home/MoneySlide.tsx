import { useEffect, useRef, useState } from "react";

import { fromJdn, monthName } from "@dotlife/calendar-core";
import { dateToJdn, localNow } from "@dotlife/tasks";

import { AD_LABEL, useAd } from "../ads";
import { useSettings } from "../hooks";
import { useMarket, type Period } from "../market";
import { TIME_ZONE } from "../noghte/model";
import {
  shortToman,
  toman,
  unlinkPaket,
  usePaketLinked,
  usePaketNews,
  useSnapshot,
  type Snapshot,
} from "../paket";
import { updateSettings } from "../settings";
import { ago, fa } from "../ui/fa";
import { Icon } from "../ui/Icon";
import { MarketCard, TickerStrip } from "./MarketCards";
import { PaketSync } from "./PaketSync";

/**
 * «پول»: the market (today's gold, coins and currencies, the world strip) and Paket's news, which
 * need no account, and the person's own money from Paket, read-only. Until Paket is linked, the
 * cards that come from it give way to one that says how to link it; the rest stays as it is. Linked:
 * the balance with accounts, debts and claims and the next fourteen days' bills, and the month's
 * spending with its budget and categories. Amounts can be hidden with one tap.
 */

const solarDay = (iso: string): string => {
  const s = fromJdn(dateToJdn(iso.slice(0, 10)), "solar-hijri");
  return fa(`${String(s.day)} ${monthName(s)}`);
};

/** «۲٫۹م» for a big amount in a small place. */
const compact = (minor: string): string => {
  const n = Number(minor);
  if (Math.abs(n) >= 1e6)
    return `${fa((n / 1e6).toFixed(1).replace(/\.0$/, "")).replace(".", "٫")}م`;
  return toman(minor);
};

/** Where a card's «← …» link goes: Paket's own site, marked with where it was clicked. */
const paketLink = (place: string): string => `https://paket.life/?src=chrome&c=money-${place}`;

function More({ place, children }: { place: string; children: string }) {
  return (
    <a
      className="ml"
      href={paketLink(place)}
      target="_blank"
      rel="noreferrer"
      title="باز کردن در پاکت"
    >
      {children} ←
    </a>
  );
}

const KINDS: Record<string, [string, string]> = {
  ipo: ["عرضه‌ی اولیه", "amber"],
  opportunity: ["فرصت سرمایه‌گذاری", "green"],
  announcement: ["اطلاعیه", "blue"],
  offer: ["پیشنهاد", "violet"],
};

export function MoneySlide() {
  const s = useSettings();
  const linked = usePaketLinked();
  // Paket and the market are asked only while this slide is on screen (and once more when it comes back)
  const root = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (el === null) return;
    const seen = new IntersectionObserver(
      ([e]) => {
        setInView(e?.isIntersecting === true);
      },
      { threshold: 0.3 },
    );
    seen.observe(el);
    return () => {
      seen.disconnect();
    };
  }, []);
  const { data, error } = useSnapshot(inView);
  const [period, setPeriod] = useState<Period>(30);
  const { prices, ticker, offline } = useMarket(period, inView);
  const news = usePaketNews();
  const hide = s.hideMoney;
  return (
    <div className={linked ? "s-pad money-s" : "s-pad money-s nobar"} ref={root}>
      {linked && (
        <div className="mbar">
          {data !== null && (
            <span className="msrc">
              <i className={error === null ? "" : "off"} />
              {error === null ? "از پاکت" : "آخرین خلاصه‌ی پاکت"} ·{" "}
              {fa(localNow(TIME_ZONE, new Date(data.generatedAt)).time)}
            </span>
          )}
          <button
            type="button"
            className="chip"
            aria-pressed={hide}
            onClick={() => {
              updateSettings({ hideMoney: !hide });
            }}
          >
            {hide ? "نمایش مبالغ" : "پنهان کردن مبالغ"}
          </button>
          <button type="button" className="chip" onClick={() => void unlinkPaket()}>
            قطع اتصال
          </button>
        </div>
      )}

      <TickerStrip ticker={ticker} />

      {!linked ? (
        <PaketSync />
      ) : data === null ? (
        <div className="card g pk-wait">
          <p>
            {error === null
              ? "خلاصه‌ی پاکت در راه است…"
              : "خلاصه‌ی پاکت نرسید؛ کمی بعد دوباره امتحان می‌کنم."}
          </p>
        </div>
      ) : (
        <PaketCards data={data} hide={hide} />
      )}

      <MarketCard prices={prices} offline={offline} period={period} setPeriod={setPeriod} />

      <News items={news} />
    </div>
  );
}

const sum = (a: string, b: string): string => (BigInt(a) - BigInt(b)).toString();

function PaketCards({ data, hide }: { data: Snapshot; hide: boolean }) {
  const amt = (minor: string): string => (hide ? "••••" : toman(minor));
  const total = shortToman(data.balance.amountMinor);
  const net = sum(data.obligations.owedToMe.amountMinor, data.obligations.owedByMe.amountMinor);
  const netShort = shortToman(net.replace("-", ""));
  const today = localNow(TIME_ZONE).date;
  // the bills and instalments of the next fourteen days (what is overdue too), earliest first
  const soon = [
    ...data.upcoming,
    ...data.obligations.items.flatMap((o) =>
      o.nextDueDate === null
        ? []
        : [
            {
              id: `ob-${o.id}`,
              title: o.title,
              dueDate: o.nextDueDate,
              amountMinor: o.amountMinor,
              currencyCode: o.currencyCode,
              categoryName: o.kind === "claim" ? "طلب" : "قسط",
              categoryColor: o.kind === "claim" ? "#8add88" : "#5ab0ff",
            },
          ],
    ),
  ]
    .filter((u) => dateToJdn(u.dueDate) - dateToJdn(today) <= 14)
    .sort((a, b) => dateToJdn(a.dueDate) - dateToJdn(b.dueDate));
  const change = data.balance.changePercent;
  return (
    <>
      <div className="card g mc">
        <div className="mh">
          <h2>موجودی</h2>
          <More place="accounts">حساب‌ها</More>
        </div>
        <div className="stats">
          <div>
            <span className="sl2">جمع {fa(data.balance.accountCount)} حساب</span>
            <b className="hn">
              {hide ? "••••" : total.value}
              <small>{hide ? "" : total.unit}</small>
            </b>
            {change !== null && (
              <span className={change >= 0 ? "pill up" : "pill dn"}>
                {change >= 0 ? "↑" : "↓"} {fa(Math.abs(change).toFixed(1)).replace(".", "٫")}٪ این
                ماه
              </span>
            )}
          </div>
          <div>
            <span className="sl2">بدهی و طلب</span>
            <b className="hn">
              {hide ? "••••" : `${net.startsWith("-") ? "−" : "+"}${netShort.value}`}
              <small>{hide ? "" : netShort.unit}</small>
            </b>
            <span className="pill mut">{fa(data.obligations.openCount)} مورد باز</span>
          </div>
        </div>
        <div className="rows">
          {data.accounts.map((a) => (
            <div key={a.id} className="rw acc">
              <i className="bk" style={{ background: a.color ?? "#3b3e48" }}>
                {firstLetter(a.name)}
              </i>
              <span className="nm">
                {a.name}
                {a.maskedIdentifier !== null && <small>{a.maskedIdentifier}</small>}
              </span>
              <span className="am">{amt(a.balanceMinor)}</span>
            </div>
          ))}
        </div>

        <div className="mh sub2">
          <h3>۱۴ روز آینده</h3>
          <More place="upcoming">خرج‌های پیش رو</More>
        </div>
        <div className="rows">
          {soon.length === 0 ? (
            <p className="none">در دو هفته‌ی آینده قبض یا قسطی ثبت نشده.</p>
          ) : (
            soon.map((u) => (
              <div key={u.id} className="rw up2">
                <span className="dt">{solarDay(u.dueDate)}</span>
                <span className="nm">{u.title}</span>
                {u.categoryName !== null ? (
                  <span
                    className="tg cat"
                    style={{ ["--c" as string]: u.categoryColor ?? "#a7a7a7" }}
                  >
                    {u.categoryName}
                  </span>
                ) : (
                  <span />
                )}
                <span className="am">{u.amountMinor === null ? "—" : amt(u.amountMinor)}</span>
              </div>
            ))
          )}
        </div>

        {data.obligations.items.length > 0 && (
          <>
            <div className="mh sub2">
              <h3>بدهی و طلب</h3>
            </div>
            <div className="rows">
              {data.obligations.items.map((o) => (
                <div key={o.id} className="rw ob">
                  <span className={o.kind === "claim" ? "tg in" : "tg"}>
                    {o.kind === "claim" ? "طلب" : "بدهی"}
                  </span>
                  <span className="nm">
                    {o.title}
                    {o.counterpartyName !== null && <small>{o.counterpartyName}</small>}
                  </span>
                  <span className="am">{amt(o.amountMinor)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {data.pendingApprovals.count > 0 && (
          <div className="pend">
            <b>{fa(data.pendingApprovals.count)}</b> پیامک بانکی منتظر تأیید در پاکت
          </div>
        )}
      </div>

      <div className="card g mc">
        <Spending data={data} hide={hide} />
        <div className="mh sub2">
          <h3>دسته‌های پرخرج</h3>
          <More place="budgets">بودجه‌ها</More>
        </div>
        <div className="rows">
          {data.categories.length === 0 && <p className="none">هنوز خرجی در این ماه ثبت نشده.</p>}
          {data.categories.map((c) => {
            const spent = Number(c.spentMinor);
            const limit = c.limitMinor === null ? null : Number(c.limitMinor);
            const share = limit === null || limit === 0 ? 0 : Math.min(1, spent / limit);
            return (
              <div key={c.id} className="rw cat2">
                <i className="cd" style={{ background: c.color ?? "#a7a7a7" }} />
                <span className="nm">{c.name}</span>
                <span className="am">{hide ? "••••" : compact(c.spentMinor)}</span>
                <span className="bar">
                  {limit !== null && (
                    <i
                      style={{
                        width: `${String(share * 100)}%`,
                        background: spent > limit ? "var(--coral)" : undefined,
                      }}
                    />
                  )}
                </span>
                <span className="bd">
                  {limit === null || hide ? "" : compact(c.limitMinor ?? "0")}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mh sub2">
          <h3>آخرین تراکنش‌ها</h3>
        </div>
        <div className="rows tx">
          {data.transactions.slice(0, 6).map((t) => (
            <div key={t.id} className="rw">
              <span className="dt">
                {solarDay(localNow(TIME_ZONE, new Date(t.occurredAt)).date)}
              </span>
              <span className="nm">{t.title}</span>
              <span className={t.direction === "credit" ? "am in" : "am"}>
                {t.direction === "credit" ? "+" : ""}
                {amt(t.amountMinor)}
              </span>
            </div>
          ))}
          {data.transactions.length === 0 && <p className="none">هنوز تراکنشی نیست.</p>}
        </div>
      </div>
    </>
  );
}

function firstLetter(name: string): string {
  const seg = new Intl.Segmenter("fa", { granularity: "grapheme" }).segment(name);
  return seg[Symbol.iterator]().next().value?.segment ?? "؟";
}

/** The month's spending: the total, what is left of the budget, and the running total drawn out to the month's end. */
function Spending({ data, hide }: { data: Snapshot; hide: boolean }) {
  const b = data.budget;
  const spent = data.monthTotals.expenseMinor;
  const title = data.month.monthName === "" ? "خرج این ماه" : `خرج ${data.month.monthName}`;
  const limit = b?.limitMinor === undefined || b.limitMinor === null ? null : Number(b.limitMinor);
  const left = b?.remainingPerDayMinor ?? null;
  return (
    <>
      <div className="mh">
        <h2>{title}</h2>
        <More place="transactions">تراکنش‌ها</More>
      </div>
      <div className="hero2">
        <b className="hn big">
          {hide ? "••••" : toman(spent)}
          <small>تومان</small>
        </b>
        {b !== null && !hide && (
          <span className="sl2">
            {limit !== null &&
              (Number(b.spentMinor) > limit
                ? `${toman(String(Number(b.spentMinor) - limit))} بیشتر از سقف`
                : `${toman(String(limit - Number(b.spentMinor)))} تا سقف بودجه`)}
            {left !== null && !left.startsWith("-") && ` · روزی ${toman(left)} جا دارید`}
          </span>
        )}
      </div>
      <SpendChart data={data} hide={hide} />
    </>
  );
}

const CW = 440;
const CH = 110;
const CP = 8;

/** Cumulative spending, step by step (one step a day), the budget's ceiling as a dashed line and Paket's forecast to the last day. */
function SpendChart({ data, hide }: { data: Snapshot; hide: boolean }) {
  const days = Math.max(2, data.month.daysInMonth);
  const daily = data.spend.dailyMinor.map(Number);
  if (daily.length === 0) return null;
  const cum: number[] = [];
  daily.reduce((acc, v) => {
    cum.push(acc + v);
    return acc + v;
  }, 0);
  const limit =
    data.budget?.limitMinor === undefined || data.budget.limitMinor === null
      ? null
      : Number(data.budget.limitMinor);
  const forecast = data.spend.forecastMinor === null ? null : Number(data.spend.forecastMinor);
  const top = Math.max(1, ...cum, limit ?? 0, forecast ?? 0);
  const x = (day: number): number => CP + ((day - 1) / (days - 1)) * (CW - 2 * CP);
  const y = (v: number): number => CH - CP - (v / top) * (CH - 2 * CP);
  // one flat run per day, then a step up to the next
  const path = cum
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${x(i + 1).toFixed(1)},${y(i === 0 ? 0 : (cum[i - 1] ?? 0)).toFixed(1)} L${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`,
    )
    .join(" ");
  const lastDay = cum.length;
  const lastV = cum.at(-1) ?? 0;
  const mname = data.month.monthName;
  const endsAt = limit !== null || forecast !== null;
  return (
    <div className="chart spend">
      {endsAt && (
        <span className="legend">
          {forecast !== null && (
            <span className="lg-f">
              پیش‌بینی آخر ماه {hide ? "••••" : compact(String(forecast))}
            </span>
          )}
          {limit !== null && (
            <span className="lg-l">سقف بودجه {hide ? "••••" : compact(String(limit))}</span>
          )}
        </span>
      )}
      <svg viewBox={`0 0 ${String(CW)} ${String(CH)}`} role="img" aria-label="خرج تجمعی ماه">
        <defs>
          <linearGradient id="spg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#8add88" stopOpacity=".28" />
            <stop offset="1" stopColor="#8add88" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L${x(lastDay).toFixed(1)},${String(CH - CP)} L${x(1).toFixed(1)},${String(CH - CP)} Z`}
          fill="url(#spg)"
        />
        {limit !== null && (
          <>
            <line
              x1={x(1)}
              y1={y(0)}
              x2={x(days)}
              y2={y(limit)}
              stroke="#a7a7a7"
              strokeDasharray="1 4"
              strokeLinecap="round"
              strokeOpacity=".8"
            />
            <circle
              cx={x(days)}
              cy={y(limit)}
              r="3"
              fill="#0f1116"
              stroke="#cfd3dc"
              strokeWidth="1.5"
            />
          </>
        )}
        {forecast !== null && (
          <>
            <line
              x1={x(lastDay)}
              y1={y(lastV)}
              x2={x(days)}
              y2={y(forecast)}
              stroke="#8add88"
              strokeDasharray="4 4"
            />
            <circle
              cx={x(days)}
              cy={y(forecast)}
              r="3"
              fill="#0f1116"
              stroke="#8add88"
              strokeWidth="1.5"
            />
          </>
        )}
        <path d={path} fill="none" stroke="#8add88" strokeWidth="1.8" strokeLinejoin="round" />
        <circle
          cx={x(lastDay)}
          cy={y(lastV)}
          r="4"
          fill="#0f1116"
          stroke="#8add88"
          strokeWidth="2"
        />
      </svg>
      <span className="axis">
        <small>
          {fa(1)} {mname}
        </small>
        <small>{fa(15)}</small>
        <small>
          {fa(days)} {mname}
        </small>
      </span>
    </div>
  );
}

/** Paket's news, and after them the slot-12 card: the same size, a dashed edge and the label. */
function News({ items }: { items: ReturnType<typeof usePaketNews> }) {
  const ad = useAd(12);
  const shown = items.slice(0, ad === null ? 5 : 4);
  return (
    <div className="card g news">
      <div className="card-h">
        <h2>خبر و پیشنهاد</h2>
        <span className="sub">از تیم پاکت · همان خبرهای صفحه‌ی خانه‌ی اپ</span>
        <More place="news">همه‌ی خبرها</More>
      </div>
      <div className="ncards">
        {shown.length === 0 && ad === null && <p className="none">خبری نیست.</p>}
        {shown.map((n) => {
          const [kind, tone] = KINDS[n.kind] ?? ["خبر", "blue"];
          return (
            <a key={n.id} className="ncard" href={n.ctaUrl ?? "#"} target="_blank" rel="noreferrer">
              <span className="kh">
                <span className={`kind ${tone}`}>{kind}</span>
                {n.pinned === true && <Icon name="pin" className="pn" />}
              </span>
              <b>{n.title}</b>
              <span className="nf">
                {n.ctaLabel !== null && <em>{n.ctaLabel} ←</em>}
                <small>{ago(n.publishedAt)}</small>
              </span>
            </a>
          );
        })}
        {ad !== null && (
          <a className="ncard adcard" href={ad.url} target="_blank" rel="noreferrer">
            <span className="kh">
              <span className="kind ad">{AD_LABEL}</span>
            </span>
            <b>{ad.title}</b>
            <span className="nf">
              {ad.cta !== undefined && <em>{ad.cta} ←</em>}
              {ad.line !== undefined && <small>{ad.line}</small>}
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
