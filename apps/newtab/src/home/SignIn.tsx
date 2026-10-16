import { useEffect, useRef, useState } from "react";

import { ApiError, requestCode, verifyCode } from "../noghte/api";
import { fa, latin } from "../ui/fa";
import { Painting } from "./Painting";

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

  const ready =
    step === "phone"
      ? latin(phone).replace(/\D/g, "").length >= 10
      : latin(code).trim().length >= 4;

  return (
    <div
      className="modal-bg dia-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dia" role="dialog" aria-modal="true" aria-labelledby="signTitle">
        <form
          className="dia-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !busy) void (step === "phone" ? ask() : verify());
          }}
        >
          <div className="dia-top">
            <span className="prog">
              <b style={{ width: step === "phone" ? "50%" : "100%" }} />
            </span>
            <button type="button" onClick={onClose}>
              بعداً
            </button>
          </div>
          <div className="dia-body">
            {step === "phone" ? (
              <>
                <h2 id="signTitle">شماره‌ات در نقطه چیست؟</h2>
                <p className="lead">
                  با همان شماره‌ای که در اپ نقطه داری. کارها، یادداشت‌ها و دسته‌هایت این‌جا می‌آیند
                  و هر چه این‌جا بنویسی روی گوشی هم دیده می‌شود.
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
            {step === "phone" && <p className="legal">با ادامه، حریم خصوصی نقطه را می‌پذیرم.</p>}
            <button type="submit" className="next" disabled={busy || !ready}>
              {step === "phone" ? "فرستادن کد" : "ورود"}{" "}
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
