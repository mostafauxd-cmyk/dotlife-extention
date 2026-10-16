import { useEffect, useRef, useState } from "react";

import { getLink, installId } from "../install";

import { ApiError, requestCode, verifyCode } from "../noghte/api";
import { fa, latin } from "../ui/fa";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/icons";
import { Qr } from "../ui/Qr";
import { Painting } from "./Painting";

/**
 * Signing in to نقطه, or signing up: a phone number, then the code sent to it by SMS — the same
 * `/auth/code/*` as the phone app. A number with no account gets one there and then, so most people
 * coming from Chrome never see a separate sign-up. The same account is the one Paket uses.
 * Beside the form, a QR code for getting the app on the phone (counted, see `install.ts`).
 * On the very first new tab it starts one step earlier, with what an account gives and «شروع».
 */

const PERKS: readonly [IconName, string, string][] = [
  ["tick-square", "کارهای گوشی، روی هر تب تازه", "تیک بزنی، روی گوشی هم تیک می‌خورد."],
  ["sticker-note", "هر چه این‌جا بنویسی، روی گوشی هم هست", "از همین سرچ، بی‌آن‌که گوشی را برداری."],
  ["refresh", "چیزی گم نمی‌شود", "کروم پاک شود یا سیستم عوض شود، همه برمی‌گردد."],
  ["profile", "یک حساب، بی‌رمز", "فقط شماره‌ی موبایل؛ همان حساب پاکت."],
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
    ? (REASONS[e.code] ?? "مشکلی پیش آمد؛ دوباره امتحان کن.")
    : "مشکلی پیش آمد.";

export function SignIn({
  start = "phone",
  onClose,
}: {
  start?: "hello" | "phone";
  onClose: (created: boolean) => void;
}) {
  const [step, setStep] = useState<"hello" | "phone" | "code">(start);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);
  const [install, setInstall] = useState<string | null>(null);

  useEffect(() => {
    void installId().then(setInstall);
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => {
      setWait((w) => w - 1);
    }, 1000);
    return () => {
      clearTimeout(t);
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

  const ready =
    step === "hello"
      ? true
      : step === "phone"
        ? latin(phone).replace(/\D/g, "").length >= 10
        : latin(code).trim().length >= 4;
  const steps = start === "hello" ? ["hello", "phone", "code"] : ["phone", "code"];
  const progress = `${String(((steps.indexOf(step) + 1) / steps.length) * 100)}%`;

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
            if (step === "hello") {
              setStep("phone");
              return;
            }
            if (ready && !busy) void (step === "phone" ? ask() : verify());
          }}
        >
          <div className="dia-top">
            <span className="prog">
              <b style={{ width: progress }} />
            </span>
            <button
              type="button"
              onClick={() => {
                onClose(false);
              }}
            >
              بعداً
            </button>
          </div>
          <div className="dia-body">
            {step === "hello" ? (
              <>
                <h2 id="signTitle" className="hello">
                  نقطه،
                  <br />
                  صفحه‌ی اول کروم تو
                </h2>
                <p className="lead">با یک حساب نقطه، این صفحه و گوشی‌ات یکی می‌شوند.</p>
                <ul className="perks">
                  {PERKS.map(([icon, title, line]) => (
                    <li key={title}>
                      <Icon name={icon} />
                      <span>
                        <b>{title}</b>
                        {line}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : step === "phone" ? (
              <>
                <h2 id="signTitle">با شماره‌ات وارد شو</h2>
                <p className="lead">
                  حساب نداری؟ با همین شماره ساخته می‌شود؛ یک حساب برای نقطه و پاکت. هر چه این‌جا
                  بنویسی روی گوشی هم دیده می‌شود.
                </p>
                <label className="fl">
                  شماره‌ی موبایل
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
                {install !== null && (
                  <div className="inst">
                    <Qr
                      text={getLink("noghte", "signin", install)}
                      label="کد نصب نقطه از کافه‌بازار"
                    />
                    <div>
                      <b>نقطه را روی گوشی هم داشته باش</b>
                      <span>
                        با دوربین گوشی اسکن کن تا نقطه در کافه‌بازار باز شود. با همین شماره وارد شو؛
                        کارها و یادداشت‌ها همگام می‌شوند.
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 id="signTitle">کد را بنویس</h2>
                <p className="lead">کدی که به {fa(phone)} پیامک شد.</p>
                <label className="fl">
                  کد ورود
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
                  {wait > 0 ? `کد تازه تا ${fa(wait)} ثانیه` : "کد تازه بفرست"}
                </button>
              </>
            )}
            {err !== "" && <span className="err">{err}</span>}
          </div>
          <div className="dia-foot">
            {step === "code" && (
              <button
                type="button"
                className="back"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setErr("");
                }}
              >
                برگشت
              </button>
            )}
            {step === "hello" && <p className="legal">رایگان است و کمتر از یک دقیقه طول می‌کشد.</p>}
            {step === "phone" && <p className="legal">با ادامه، حریم خصوصی نقطه را می‌پذیرم.</p>}
            <button
              type="submit"
              className="next"
              disabled={busy || !ready}
              autoFocus={step === "hello"}
            >
              {step === "hello" ? "شروع" : step === "phone" ? "فرستادن کد" : "ورود"}{" "}
              <svg className="kbd" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 6v5a3 3 0 0 1-3 3H6m0 0 4-4m-4 4 4 4" />
              </svg>
            </button>
          </div>
        </form>
        <Painting step={step} />
      </div>
    </div>
  );
}
