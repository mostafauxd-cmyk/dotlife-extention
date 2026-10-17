import { useState } from "react";

import { localNow } from "@dotlife/tasks";

import {
  BADGE,
  type Period,
  type PriceItem,
  type Prices,
  type Ticker,
  type TickerItem,
} from "../market";
import { TIME_ZONE } from "../noghte/model";
import { toman } from "../paket";
import { fa } from "../ui/fa";

/**
 * The market half of the money slide, from Paket's public prices — it needs no link: the strip of
 * world metals and crypto above, and «قیمت روز» (gold, coins, currencies, with a chart per row).
 */

const UP = "#8add88";
const DN = "#f0817a";

const clockOf = (iso: string | null): string =>
  iso === null ? "" : fa(localNow(TIME_ZONE, new Date(iso)).time);

/** «▲ ۰٫۴۱٪» */
const change = (pct: number): string =>
  `${pct >= 0 ? "▲" : "▼"} ${fa(Math.abs(pct).toFixed(2)).replace(".", "٫")}٪`;

const usd = (n: number): string =>
  fa(
    n
      .toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 3 : n < 1000 ? 2 : 1 })
      .replace(/,/g, "٬")
      .replace(".", "٫"),
  );

function Badge({ id, small }: { id: string; small?: boolean }) {
  const b = BADGE[id] ?? { glyph: "؟", bg: "#3a3d48" };
  return (
    <i
      className={small ? "ai sm" : "ai"}
      style={{ background: b.bg, color: b.dark === true ? "#3a2a05" : undefined }}
    >
      {b.glyph}
    </i>
  );
}

// ---- the strip ----

function TickerCell({ t }: { t: TickerItem }) {
  const b = BADGE[t.id];
  return (
    <span className={t.live ? "tk-i" : "tk-i stale"}>
      <i
        className="g"
        style={{ background: b?.bg ?? "#3a3d48", color: b?.dark === true ? "#3a2a05" : undefined }}
      >
        {t.glyph}
      </i>
      <span className="n">{t.name}</span>
      <span className="v">
        {t.unit === "USD" ? (
          `$${usd(t.price)}`
        ) : (
          <>
            {toman(String(Math.round(t.price)))}
            <small>تومان</small>
          </>
        )}
      </span>
      {t.changePct !== null && (
        <span className={t.changePct >= 0 ? "c up" : "c dn"}>{change(t.changePct)}</span>
      )}
    </span>
  );
}

export function TickerStrip({ ticker }: { ticker: Ticker | null }) {
  const items = ticker?.items ?? [];
  return (
    <div className="ticker" aria-label="قیمت جهانی و رمزارز">
      <span className="tk-h">
        <i className={ticker?.live === true ? "" : "off"} />
        جهانی و رمزارز
      </span>
      <div className="tk-vp">
        {items.length === 0 ? (
          <span className="tk-none">
            {ticker === null ? "قیمت‌ها در راه است…" : "الان قیمتی در دسترس نیست."}
          </span>
        ) : (
          // the run is shown twice so it can slide round without a gap
          <div className="tk-track">
            {[0, 1].map((k) => (
              <span key={k} className="tk-run" aria-hidden={k === 1 ? true : undefined}>
                {items.map((t) => (
                  <TickerCell key={t.id} t={t} />
                ))}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="tk-src">
        {ticker?.lastUpdated !== undefined && ticker.lastUpdated !== null
          ? `به‌روز شده ${clockOf(ticker.lastUpdated)}`
          : ""}
      </span>
    </div>
  );
}

// ---- the card ----

const W = 440;
const H = 62;
const P = 6;

function PriceChart({
  vals,
  stepDays,
  label,
}: {
  vals: number[];
  stepDays: number;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (vals.length < 2) return <div className="chart empty" />;
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const pts = vals.map((v, i): [number, number] => [
    P + (i / (vals.length - 1)) * (W - 2 * P),
    P + (1 - (v - mn) / (mx - mn || 1)) * (H - 2 * P),
  ]);
  const col = (vals.at(-1) ?? 0) >= (vals[0] ?? 0) ? UP : DN;
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts.at(-1) ?? [0, 0];
  const h = hover === null ? null : pts[hover];
  const back = hover === null ? 0 : vals.length - 1 - hover;
  const when =
    back === 0
      ? "الان"
      : stepDays === 7
        ? `${fa(back)} هفته پیش`
        : `${fa(back * stepDays)} روز پیش`;
  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        role="img"
        aria-label={label}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(
            Math.max(
              0,
              Math.min(vals.length - 1, Math.round(((px - P) / (W - 2 * P)) * (vals.length - 1))),
            ),
          );
        }}
        onMouseLeave={() => {
          setHover(null);
        }}
      >
        <defs>
          <linearGradient id="pxg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={col} stopOpacity=".2" />
            <stop offset="1" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${String(P)},${String(H)} ${line} ${String(W - P)},${String(H)}`}
          fill="url(#pxg)"
        />
        <polyline points={line} fill="none" stroke={col} strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="4" fill="#0f1116" stroke={col} strokeWidth="2" />
        {h !== null && h !== undefined && (
          <>
            <line x1={h[0]} x2={h[0]} y1="0" y2={H} stroke="rgba(255,255,255,.3)" />
            <circle cx={h[0]} cy={h[1]} r="3.5" fill={col} />
          </>
        )}
      </svg>
      {h !== null && h !== undefined && hover !== null && (
        <div
          className="tipbox"
          style={{ left: `${String((h[0] / W) * 100)}%`, top: `${String((h[1] / H) * 100)}%` }}
        >
          {toman(String(Math.round(vals[hover] ?? 0)))} <span>· {when}</span>
        </div>
      )}
    </div>
  );
}

const PERIODS: readonly [Period, string, string][] = [
  [7, "هفته", "این هفته"],
  [30, "ماه", "این ماه"],
  [365, "سال", "امسال"],
];
const GROUPS: readonly ["gold" | "fx", string][] = [
  ["gold", "طلا و سکه"],
  ["fx", "ارز"],
];

function Row({
  it,
  on,
  series,
  pick,
}: {
  it: PriceItem;
  on: boolean;
  series: number[] | undefined;
  pick: () => void;
}) {
  const up = (it.changePct ?? 0) >= 0;
  return (
    <button type="button" className={on ? "prow on" : "prow"} onClick={pick}>
      <Badge id={it.id} small />
      <span className="nm2">
        <b>
          {it.name}
          <i className={it.live ? "live-dot" : "live-dot off"} />
        </b>
        <small>{it.sub}</small>
      </span>
      <Spark vals={series} up={up} />
      <span className="pv">
        <b>{toman(String(Math.round(it.price)))}</b>
        {it.changePct !== null && (
          <small className={up ? "up" : "dn"}>{change(it.changePct)}</small>
        )}
      </span>
    </button>
  );
}

/** A row's small chart: the chosen period, as the big one but without the axes. */
function Spark({ vals, up }: { vals: number[] | undefined; up: boolean }) {
  if (vals === undefined || vals.length < 2) return <span />;
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const pts = vals
    .map(
      (v, i) =>
        `${(2 + (i / (vals.length - 1)) * 56).toFixed(1)},${(2 + (1 - (v - mn) / (mx - mn || 1)) * 18).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 60 22" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? UP : DN}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MarketCard({
  prices,
  offline,
  period,
  setPeriod,
}: {
  prices: Prices | null;
  offline: boolean;
  period: Period;
  setPeriod: (p: Period) => void;
}) {
  const [group, setGroup] = useState<"gold" | "fx">("gold");
  const [sel, setSel] = useState<string | null>(null);
  const items = prices?.items ?? [];
  const groups = GROUPS.filter(([g]) => items.some((i) => i.group === g));
  const here = groups.some(([g]) => g === group) ? group : (groups[0]?.[0] ?? group);
  const rows = items.filter((i) => i.group === here);
  const cur = rows.find((i) => i.id === sel) ?? rows[0];
  const series = prices?.history?.series;
  const vals = cur === undefined ? undefined : series?.[cur.id];
  const first = vals?.[0];
  const span =
    vals !== undefined && first !== undefined && first !== 0
      ? ((vals.at(-1) ?? first) / first - 1) * 100
      : null;

  return (
    <div className="card g mc mkt">
      <div className="mh">
        <h2>قیمت روز</h2>
        {cur !== undefined && (
          <span className={cur.live ? "live" : "live off"}>
            <i />
            {cur.live ? "زنده" : "آخرین قیمت"} · {clockOf(cur.asOf)}
          </span>
        )}
      </div>
      {cur === undefined ? (
        <p className="none">
          {prices === null
            ? offline
              ? "به پاکت وصل نشد؛ کمی بعد دوباره امتحان می‌کنم."
              : "قیمت‌ها در راه است…"
            : "الان قیمتی در دسترس نیست."}
        </p>
      ) : (
        <>
          <div className="pxtop">
            <Badge id={cur.id} />
            <span className="nm2">
              <b>{cur.name}</b>
              <small>{cur.sub}</small>
            </span>
            <div className="seg2" role="group" aria-label="دوره‌ی نمودار">
              {PERIODS.map(([p, name]) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => {
                    setPeriod(p);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="pxv">
            <b className="hn">{toman(String(Math.round(cur.price)))}</b>
            <small>تومان</small>
            {span !== null && (
              <span className={span >= 0 ? "pill up" : "pill dn"}>
                {change(span)} {PERIODS.find(([p]) => p === period)?.[2]}
              </span>
            )}
          </div>
          <PriceChart
            vals={vals ?? []}
            stepDays={prices?.history?.stepDays ?? 1}
            label={`نمودار ${cur.name}`}
          />
          {groups.length > 1 && (
            <div className="mtabs morph" role="tablist" aria-label="گروه قیمت">
              {groups.map(([g, name]) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={here === g}
                  onClick={() => {
                    setGroup(g);
                    setSel(null);
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <div className="plist">
            {rows.map((it) => (
              <Row
                key={it.id}
                it={it}
                on={it.id === cur.id}
                series={series?.[it.id]}
                pick={() => {
                  setSel(it.id);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
