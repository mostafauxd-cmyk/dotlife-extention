import { useEffect, useState } from "react";

import { fromJdn, monthName } from "@dotlife/calendar-core";
import { dateToJdn, localNow } from "@dotlife/tasks";

import { useSettings } from "../hooks";
import { getLink, installId } from "../install";
import { TIME_ZONE } from "../noghte/model";
import {
  linkPaket,
  PaketError,
  shortToman,
  toman,
  unlinkPaket,
  usePaketLinked,
  usePaketNews,
  useSnapshot,
  type Snapshot,
} from "../paket";
import { updateSettings } from "../settings";
import { fa } from "../ui/fa";
import { Qr } from "../ui/Qr";

/**
 * «پول»: the person's money from Paket, read-only. Not linked yet: what it shows and how to link —
 * the code from the phone's «تنظیمات ← دستگاه‌ها و افزونه», typed here — and a QR to get Paket.
 * Linked: the balance with the debts and claims, the next fourteen days' bills, the month's budget
 * with the latest transactions, and Paket's news. Amounts can be hidden with one tap.
 */

const REASONS: Record<string, string> = {
  INVALID_PAIRING_CODE: "این کد درست نیست یا وقتش گذشته؛ از گوشی کد تازه بگیر.",
  TOO_MANY_REQUESTS: "چند بار پشت هم امتحان شد؛ یک دقیقه صبر کن.",
  VALIDATION_ERROR: "کد هشت‌حرفی را کامل بنویس.",
  offline: "به پاکت وصل نشد. اینترنت را بررسی کن.",
};

const solarDay = (iso: string): string => {
  const s = fromJdn(dateToJdn(iso.slice(0, 10)), "solar-hijri");
  return fa(`${String(s.day)} ${monthName(s)}`);
};

export function MoneySlide() {
  const linked = usePaketLinked();
  return <div className="s-pad money-s">{linked ? <Linked /> : <NotLinked />}</div>;
}

function NotLinked() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [install, setInstall] = useState<string | null>(null);
  useEffect(() => {
    void installId().then(setInstall);
  }, []);
  const ready = code.replace(/[^0-9A-Za-z]/g, "").length >= 8;
  const link = async (): Promise<void> => {
    setBusy(true);
    setErr("");
    try {
      await linkPaket(code);
    } catch (e) {
      setErr(REASONS[e instanceof PaketError ? e.code : ""] ?? "وصل نشد؛ دوباره امتحان کن.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card g pk-empty">
      <div className="pke-copy">
        <span className="pke-lg">پ</span>
        <h2>پول‌هایت را هم همین‌جا ببین</h2>
        <p>
          پاکت را به این صفحه وصل کن تا موجودی، بودجه‌ی ماه، آخرین خرج‌ها، قبض‌های پیش رو و بدهی و
          طلبت روی هر تب تازه دیده شود. فقط خواندنی است؛ از این‌جا چیزی در پاکت عوض نمی‌شود.
        </p>
        <ol className="pke-steps">
          <li>پاکت را روی گوشی باز کن.</li>
          <li>
            برو به <b>تنظیمات ← دستگاه‌ها و افزونه</b> و «اتصال افزونه» را بزن.
          </li>
          <li>کد هشت‌حرفی‌ای را که نشان می‌دهد این‌جا بنویس.</li>
        </ol>
        <form
          className="pke-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !busy) void link();
          }}
        >
          <input
            className="ltr"
            value={code}
            placeholder="K7QM-4XDA"
            aria-label="کد پاکت"
            autoComplete="off"
            maxLength={40}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErr("");
            }}
          />
          <button type="submit" className="cta" disabled={!ready || busy}>
            {busy ? "در حال وصل شدن…" : "وصل شو"}
          </button>
        </form>
        {err !== "" && <p className="pke-err">{err}</p>}
      </div>
      {install !== null && (
        <div className="pke-qr">
          <Qr text={getLink("paket", "money-slide", install)} label="کد نصب پاکت از کافه‌بازار" />
          <b>پاکت را نداری؟</b>
          <small>با دوربین گوشی اسکن کن تا از کافه‌بازار نصبش کنی.</small>
        </div>
      )}
    </div>
  );
}

function Linked() {
  const s = useSettings();
  const { data, error } = useSnapshot();
  const news = usePaketNews();
  const hide = s.hideMoney;
  const amt = (minor: string): string => (hide ? "••••" : toman(minor));

  if (data === null) {
    return (
      <div className="card g pk-wait">
        <p>
          {error === null
            ? "خلاصه‌ی پاکت در راه است…"
            : "خلاصه‌ی پاکت نرسید؛ کمی بعد دوباره امتحان می‌کنم."}
        </p>
        <button type="button" className="ghost" onClick={() => void unlinkPaket()}>
          قطع اتصال
        </button>
      </div>
    );
  }
  const total = shortToman(data.balance.amountMinor);
  const today = localNow(TIME_ZONE).date;
  const soon = data.upcoming.filter((u) => dateToJdn(u.dueDate) - dateToJdn(today) <= 14);
  return (
    <>
      <div className="mbar">
        <h2>پول</h2>
        <span className="msrc">
          <i />
          از پاکت · {fa(localNow(TIME_ZONE, new Date(data.generatedAt)).time)}
        </span>
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

      <div className="card g mc">
        <div className="mh">
          <h2>موجودی</h2>
        </div>
        <div className="stats">
          <div>
            <span className="sl2">جمع حساب‌ها</span>
            <b className="hn">
              {hide ? "••••" : total.value}
              <small>{hide ? "" : total.unit}</small>
            </b>
          </div>
          <div>
            <span className="sl2">طلب از دیگران</span>
            <b className="hn sm">{amt(data.obligations.owedToMe.amountMinor)}</b>
            <span className="sl2">
              بدهی به دیگران · {amt(data.obligations.owedByMe.amountMinor)}
            </span>
          </div>
        </div>
        <div className="mh sub2">
          <h3>۱۴ روز آینده</h3>
        </div>
        <div className="rows">
          {soon.length === 0 ? (
            <p className="none">در دو هفته‌ی آینده قبض یا قسطی ثبت نشده.</p>
          ) : (
            soon.map((u) => (
              <div key={u.id} className="rw">
                <span className="dt">{solarDay(u.dueDate)}</span>
                <span className="nm">{u.title}</span>
                <span className="am">{u.amountMinor === null ? "—" : amt(u.amountMinor)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card g mc">
        <Budget data={data} hide={hide} />
        <div className="mh sub2">
          <h3>آخرین تراکنش‌ها</h3>
        </div>
        <div className="rows tx">
          {data.transactions.slice(0, 8).map((t) => (
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

      <div className="card g mc">
        <div className="mh">
          <h2>بدهی و طلب</h2>
        </div>
        <div className="rows">
          {data.obligations.items.length === 0 ? (
            <p className="none">بدهی یا طلب بازی نیست.</p>
          ) : (
            data.obligations.items.map((o) => (
              <div key={o.id} className="rw">
                <span className={o.kind === "claim" ? "tg in" : "tg"}>
                  {o.kind === "claim" ? "طلب" : "بدهی"}
                </span>
                <span className="nm">
                  {o.title}
                  {o.counterpartyName !== null && <small>{o.counterpartyName}</small>}
                </span>
                <span className="am">{amt(o.amountMinor)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card g news">
        <div className="card-h">
          <h2>خبر و پیشنهاد</h2>
          <span className="sub">از تیم پاکت · همان خبرهای صفحه‌ی خانه‌ی اپ</span>
        </div>
        <div className="ncards">
          {news.length === 0 ? (
            <p className="none">خبری نیست.</p>
          ) : (
            news.slice(0, 4).map((n) => (
              <a
                key={n.id}
                className="ncard"
                href={n.ctaUrl ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                <b>{n.title}</b>
                <span>{n.summary}</span>
                {n.ctaLabel !== null && <em>{n.ctaLabel}</em>}
              </a>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Budget({ data, hide }: { data: Snapshot; hide: boolean }) {
  const b = data.budget;
  if (b === null) {
    return (
      <div className="mh">
        <h2>بودجه‌ی ماه</h2>
        <span className="sl2">در پاکت بودجه‌ای روی سرور نیست.</span>
      </div>
    );
  }
  const spent = Number(b.spentMinor);
  const limit = b.limitMinor === null ? null : Number(b.limitMinor);
  const share = limit === null || limit === 0 ? 0 : Math.min(1, spent / limit);
  return (
    <>
      <div className="mh">
        <h2>{b.name}</h2>
      </div>
      <div className="hero2">
        <b className="hn big">
          {hide ? "••••" : toman(b.spentMinor)}
          <small>تومان</small>
        </b>
        {limit !== null && !hide && (
          <span className="sl2">
            از سقف {toman(String(limit))} ·{" "}
            {spent > limit
              ? `${toman(String(spent - limit))} بیشتر از سقف`
              : `${toman(String(limit - spent))} مانده`}
          </span>
        )}
      </div>
      {limit !== null && (
        <div className={share >= 1 ? "bar over" : share >= 0.8 ? "bar warn" : "bar"}>
          <i style={{ width: `${String(share * 100)}%` }} />
        </div>
      )}
    </>
  );
}
