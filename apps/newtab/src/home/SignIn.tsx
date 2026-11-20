import { useEffect, useRef, useState } from "react";

import { t, LANGS } from "../i18n";
import { getLink, installId } from "../install";
import {
  ApiError,
  pollLink,
  requestCode,
  startLink,
  verifyCode,
  type LinkStart,
} from "../noghte/api";
import { updateSettings } from "../settings";
import { useSettings } from "../hooks";
import { fa, latin } from "../ui/fa";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/icons";
import { Qr } from "../ui/Qr";
import { Painting } from "./Painting";
import { PersonaPicker } from "./PersonaPicker";

/**
 * The welcome and signing in to نقطه (2026-11-20, the user: «از ابتدا زبان رو بگیریم … سینک کردن رو
 * از شماره موبایل در بیاریم و … ببریم اخرین گزینه و قابل اسکیپ و اونجا بهش کیوارکد نشون بدیم …
 * اتصال با شماره موبایل گزینه دوم باشه»).
 *
 * The first new tab: the language → what نقطه is → personas → linking with the phone, last and
 * skippable. Linking shows a QR code the phone app scans in its «افزونه» tab (`startLink`); the
 * phone number and an SMS code are the second way, the same `/auth/code/*` as the app (a number
 * with no account gets one there and then). Signing in later starts at the linking step.
 */

type Step = "lang" | "hello" | "persona" | "link" | "phone" | "code";

const PERKS: readonly [IconName, string, string][] = [
  ["tick-square", "کارهای گوشی، روی هر تب تازه", "تیک بزنی، روی گوشی هم تیک می‌خورد."],
  ["sticker-note", "هر چه این‌جا بنویسی، روی گوشی هم هست", "از همین سرچ، بی‌آن‌که گوشی را برداری."],
  ["refresh", "چیزی گم نمی‌شود", "کروم پاک شود یا سیستم عوض شود، همه برمی‌گردد."],
];

const REASONS: Record<string, string> = {
  bad_target: "این شماره درست نیست.",
  too_soon: "کمی صبر کن و دوباره بخواه.",
  too_many: "بیش از حد درخواست شد؛ کمی بعد دوباره امتحان کن.",
  kind_off: "ورود با پیامک فعلاً بسته است.",
  unreachable: "پیامک به این شماره نمی‌رسد.",
  send_failed: "پیامک فرستاده نشد؛ دوباره امتحان کن.",
  code_invalid: "کد درست نیست.",
  code_expired: "کد منقضی شده؛ کد تازه بخواه.",
  code_locked: "تلاش‌ها تمام شد؛ کد تازه بخواه.",
  offline: "به سرور نقطه وصل نشد. اینترنت را بررسی کن.",
  off: "این بخش فعلاً بسته است.",
};
const reason = (e: unknown): string =>
  e instanceof ApiError
    ? t(REASONS[e.code] ?? "مشکلی پیش آمد؛ دوباره امتحان کن.")
    : t("مشکلی پیش آمد.");

/** The wait before another code: seconds under a minute, else «۳۰:۴۱» (not «۱۸۴۱ ثانیه»). */
function waitText(s: number): string {
  if (s < 60) return t("{n} ثانیه", { n: fa(s) });
  return fa(`${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, "0")}`);
}

/**
 * The QR to scan with the phone app. A link lives a few minutes: a fresh one is asked for when it
 * runs out. `null` while asking; `"none"` when the server has no linking yet (or is out of reach).
 */
function useLink(on: boolean, onLinked: () => void): LinkStart | null | "none" {
  const [link, setLink] = useState<LinkStart | null | "none">(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!on) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setLink(null);
    void startLink().then(
      (l) => {
        if (!live) return;
        setLink(l);
        const until = Date.now() + l.expiresIn * 1000;
        const look = (): void => {
          if (!live) return;
          if (Date.now() > until) {
            setRound((r) => r + 1);
            return;
          }
          void pollLink(l).then(
            (r) => {
              if (!live) return;
              if (r === "expired") setRound((x) => x + 1);
              else if (r === "linked") onLinked();
              else timer = setTimeout(look, Math.max(1, l.pollEvery) * 1000);
            },
            () => {
              if (live) timer = setTimeout(look, 5000);
            },
          );
        };
        timer = setTimeout(look, Math.max(1, l.pollEvery) * 1000);
      },
      () => {
        if (live) setLink("none");
      },
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // onLinked is the dialog's own close, the same for its whole life
  }, [on, round]);
  return link;
}

export function SignIn({
  start = "phone",
  onClose,
}: {
  start?: "hello" | "phone";
  onClose: (created: boolean) => void;
}) {
  const steps: Step[] =
    start === "hello"
      ? ["lang", "hello", "persona", "link", "phone", "code"]
      : ["link", "phone", "code"];
  const [step, setStep] = useState<Step>(steps[0] ?? "link");
  const s = useSettings();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);
  const [install, setInstall] = useState<string | null>(null);
  const link = useLink(step === "link", () => {
    onClose(false);
  });

  useEffect(() => {
    void installId().then(setInstall);
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const tm = setTimeout(() => {
      setWait((w) => w - 1);
    }, 1000);
    return () => {
      clearTimeout(tm);
    };
  }, [wait]);

  const ask = async (): Promise<void> => {
    setBusy(true);
    setErr("");
    try {
      const r = await requestCode(latin(phone).replace(/\s/g, ""));
      setStep("code");
      setWait(r.retryAfter);
      setTimeout(() => codeInput.current?.focus(), 0);
    } catch (e) {
      setErr(reason(e));
      if (e instanceof ApiError && typeof e.data.retryAfter === "number")
        setWait(e.data.retryAfter);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (): Promise<void> => {
    setBusy(true);
    setErr("");
    try {
      const r = await verifyCode(latin(phone).replace(/\s/g, ""), latin(code).trim());
      onClose(r.created);
    } catch (e) {
      setErr(reason(e));
    } finally {
      setBusy(false);
    }
  };

  const go = (to: Step): void => {
    setErr("");
    setStep(to);
  };
  /** The step before this one, for «برگشت» (none on the first). */
  const prev: Step | undefined =
    step === "code" ? "phone" : step === "phone" ? "link" : steps[steps.indexOf(step) - 1];

  const ready =
    step === "phone"
      ? latin(phone).replace(/\D/g, "").length >= 10
      : step === "code"
        ? latin(code).trim().length >= 4
        : true;
  const progress = `${String(((steps.indexOf(step) + 1) / steps.length) * 100)}%`;
  const next =
    step === "lang" || step === "persona"
      ? t("ادامه")
      : step === "hello"
        ? t("شروع")
        : step === "link"
          ? t("با شماره‌ی موبایل وارد شو")
          : step === "phone"
            ? t("فرستادن کد")
            : t("ورود");

  return (
    <div
      className="modal-bg dia-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div className="dia" role="dialog" aria-modal="true" aria-labelledby="signTitle">
        <form
          className="dia-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === "lang") go("hello");
            else if (step === "hello") go("persona");
            else if (step === "persona") go("link");
            else if (step === "link") go("phone");
            else if (ready && !busy) void (step === "phone" ? ask() : verify());
          }}
        >
          <div className="dia-top">
            <span className="prog">
              <b style={{ width: progress }} />
            </span>
            <button
              type="button"
              className="later"
              aria-label={t("بعداً")}
              title={t("بعداً")}
              onClick={() => {
                onClose(false);
              }}
            >
              <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 7l10 10M17 7 7 17" />
              </svg>
            </button>
          </div>
          <div className="dia-body">
            {step === "lang" ? (
              <>
                <h2 id="signTitle">زبان · Language</h2>
                <p className="lead">
                  {t("نقطه را به چه زبانی ببینی؟ بعداً هم در شخصی‌سازی عوض می‌شود.")}
                </p>
                <div className="langs" role="radiogroup" aria-label="Language">
                  {LANGS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={s.lang === l.id}
                      dir={l.dir}
                      lang={l.id}
                      className="lang"
                      onClick={() => {
                        updateSettings({ lang: l.id });
                      }}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </>
            ) : step === "hello" ? (
              <>
                <h2 id="signTitle" className="hello">
                  {t("نقطه،")}
                  <br />
                  {t("صفحه‌ی اول کروم تو")}
                </h2>
                <p className="lead">
                  {t("کارها، یادداشت‌ها، تقویم و قیمت‌های روز، روی هر تب تازه.")}
                </p>
                <ul className="perks">
                  {PERKS.map(([icon, title, line]) => (
                    <li key={title}>
                      <Icon name={icon} />
                      <span>
                        <b>{t(title)}</b>
                        {t(line)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : step === "persona" ? (
              <>
                <h2 id="signTitle">{t("کدام بیشتر شبیه توست؟")}</h2>
                <p className="lead">
                  {t(
                    "هر چند تا که به تو می‌خورد را انتخاب کن؛ دسترسی سریع زیر سرچ را با سایت‌های همین کارها می‌چینیم. هر وقت خواستی در شخصی‌سازی عوضش کن.",
                  )}
                </p>
                <PersonaPicker />
              </>
            ) : step === "link" ? (
              <>
                <h2 id="signTitle">{t("به نقطه‌ی گوشی‌ات وصل شو")}</h2>
                <p className="lead">
                  {t(
                    "کارها و یادداشت‌ها بین این صفحه و گوشی یکی می‌شوند. اختیاری است؛ بدون آن هم همه چیز روی همین مرورگر کار می‌کند.",
                  )}
                </p>
                <div className="link-qr">
                  {link !== null && link !== "none" ? (
                    <Qr text={link.url} label={t("کد اتصال به اپ نقطه")} />
                  ) : link === null ? (
                    <span className="qr-wait" aria-label={t("در حال ساختن کد…")} />
                  ) : install !== null ? (
                    <Qr text={getLink("noghte", "signin", install)} label={t("کد نصب نقطه")} />
                  ) : (
                    <span className="qr-wait" />
                  )}
                  <ol className="link-steps">
                    {link === "none" ? (
                      <>
                        <li>{t("نقطه را با این کد روی گوشی نصب کن.")}</li>
                        <li>{t("بعد با شماره‌ی موبایلت همین‌جا وارد شو.")}</li>
                      </>
                    ) : (
                      <>
                        <li>{t("اپ نقطه را روی گوشی باز کن.")}</li>
                        <li>
                          {t(
                            "در پروفایل، «دستگاه‌ها و افزونه» را باز کن و «اسکن کد افزونه» را بزن.",
                          )}
                        </li>
                        <li>{t("دوربین را روی این کد بگیر؛ همین‌جا خودکار وصل می‌شوی.")}</li>
                      </>
                    )}
                  </ol>
                </div>
              </>
            ) : step === "phone" ? (
              <>
                <h2 id="signTitle">{t("با شماره‌ات وارد شو")}</h2>
                <p className="lead">
                  {t(
                    "حساب نداری؟ با همین شماره ساخته می‌شود. هر چه این‌جا بنویسی روی گوشی هم دیده می‌شود.",
                  )}
                </p>
                <label className="fl">
                  {t("شماره‌ی موبایل")}
                  <input
                    className="ltr"
                    inputMode="tel"
                    autoFocus
                    value={phone}
                    placeholder="0912 345 6789"
                    onChange={(e) => {
                      setPhone(e.target.value);
                    }}
                  />
                </label>
              </>
            ) : (
              <>
                <h2 id="signTitle">{t("کد را بنویس")}</h2>
                <p className="lead">{t("کدی که به {phone} پیامک شد.", { phone: fa(phone) })}</p>
                <label className="fl">
                  {t("کد ورود")}
                  <input
                    ref={codeInput}
                    className="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    placeholder="------"
                    onChange={(e) => {
                      setCode(e.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="again"
                  disabled={wait > 0 || busy}
                  onClick={() => void ask()}
                >
                  {wait > 0 ? t("کد تازه تا {wait}", { wait: waitText(wait) }) : t("کد تازه بفرست")}
                </button>
              </>
            )}
          </div>
          <div className="dia-foot">
            {/* here, not in the scrolling body: under the QR box it was out of sight on a short window
                and «too soon» looked like a dead button (2026-10-17) */}
            {err !== "" && (
              <span className="err" role="alert">
                {err}
                {step === "phone" && wait > 0
                  ? ` ${t("کد تازه تا {wait}.", { wait: waitText(wait) })}`
                  : ""}
              </span>
            )}
            {step === "hello" && (
              <p className="legal">{t("رایگان است و کمتر از یک دقیقه طول می‌کشد.")}</p>
            )}
            {step === "phone" && (
              <p className="legal">{t("با ادامه، حریم خصوصی نقطه را می‌پذیرم.")}</p>
            )}
            <div className="dia-actions">
              {prev !== undefined && (
                <button
                  type="button"
                  className="back"
                  onClick={() => {
                    if (step === "code") setCode("");
                    go(prev);
                  }}
                >
                  <svg className="ic flip-dir" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m10 6 6 6-6 6" />
                  </svg>
                  {t("برگشت")}
                </button>
              )}
              {step === "link" && (
                <button
                  type="button"
                  className="skip"
                  onClick={() => {
                    onClose(false);
                  }}
                >
                  {t("فعلاً نه")}
                </button>
              )}
              <button
                type="submit"
                className={step === "link" ? "next second" : "next"}
                disabled={busy || !ready}
                autoFocus={step === "hello" || step === "lang"}
              >
                {next}{" "}
                {step !== "link" && (
                  <svg className="kbd flip-dir" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 6v5a3 3 0 0 1-3 3H6m0 0 4-4m-4 4 4 4" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
        <Painting
          step={step === "code" ? "code" : step === "phone" || step === "link" ? "phone" : "hello"}
        />
      </div>
    </div>
  );
}
