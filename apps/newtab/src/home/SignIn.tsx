import { useEffect, useRef, useState } from "react";

import { ApiError, requestCode, verifyCode } from "../noghte/api";
import { fa, latin } from "../ui/fa";
import { Icon } from "../ui/Icon";

/**
 * Signing in to نقطه with the phone number the app uses: a code by SMS, then the code — the same
 * `/auth/code/*` as the phone, so it is the same account and its tasks and notes come straight in.
 */

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

export function SignIn({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

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
      await verifyCode(latin(phone).replace(/\s/g, ""), latin(code).trim());
      onClose();
    } catch (e) {
      setErr(reason(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="signTitle">
        <div className="card-h">
          <h2 id="signTitle">ورود به نقطه</h2>
          <button type="button" className="rbtn" aria-label="بستن" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <p>
          با همان شماره‌ای وارد شو که در اپ نقطه داری. کارها، یادداشت‌ها و دسته‌هایت این‌جا می‌آیند
          و هر چه این‌جا بنویسی روی گوشی هم دیده می‌شود.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (step === "phone" ? ask() : verify());
          }}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          {step === "phone" ? (
            <label className="field">
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
          ) : (
            <label className="field">
              کدی که به {fa(phone)} پیامک شد
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
          )}
          <div className="mfoot">
            {err !== "" && <span className="err">{err}</span>}
            {step === "code" && (
              <button
                type="button"
                className="ghost"
                disabled={wait > 0 || busy}
                onClick={() => void ask()}
              >
                {wait > 0 ? `کد تازه تا ${fa(wait)} ثانیه` : "کد تازه"}
              </button>
            )}
            <button
              type="submit"
              className="cta"
              disabled={
                busy ||
                (step === "phone"
                  ? latin(phone).replace(/\D/g, "").length < 10
                  : latin(code).trim().length < 4)
              }
            >
              {step === "phone" ? "فرستادن کد" : "ورود"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
