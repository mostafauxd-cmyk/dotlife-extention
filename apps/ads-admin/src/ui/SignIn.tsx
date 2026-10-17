import { useEffect, useState } from "react";

import { AuthError, cleanPhone, requestCode, verifyCode } from "../data/auth";

/** What went wrong, in words an admin can act on. */
function messageOf(e: unknown): string {
  const code = e instanceof AuthError ? e.code : "";
  const status = e instanceof AuthError ? e.status : 0;
  if (code === "not_admin") return "این شماره ادمین نقطه نیست.";
  if (status === 429) return "چند بار پشت هم تلاش شد؛ کمی بعد دوباره امتحان کن.";
  if (status === 400 || status === 401) return "کد درست نیست یا منقضی شده.";
  return "سرور نقطه جواب نداد.";
}

const WAIT_S = 60;

/** Phone, then the code sent to it; a new code only after a minute. */
export function SignInForm({ compact = false }: { compact?: boolean }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => {
      setWait((w) => w - 1);
    }, 1000);
    return () => {
      window.clearTimeout(t);
    };
  }, [wait]);

  const send = (): void => {
    const p = cleanPhone(phone);
    if (p === null) {
      setError("شماره را مثل ۰۹۱۲۳۴۵۶۷۸۹ بنویس.");
      return;
    }
    setBusy(true);
    setError(null);
    requestCode(p).then(
      () => {
        setBusy(false);
        setSentTo(p);
        setWait(WAIT_S);
      },
      (e: unknown) => {
        setBusy(false);
        setError(messageOf(e));
      },
    );
  };
  const verify = (): void => {
    if (sentTo === null) return;
    setBusy(true);
    setError(null);
    verifyCode(
      sentTo,
      code.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))),
    ).then(
      () => {
        setBusy(false);
      },
      (e: unknown) => {
        setBusy(false);
        setCode("");
        setError(messageOf(e));
      },
    );
  };

  return (
    <form
      className={compact ? "signin compact" : "signin"}
      onSubmit={(e) => {
        e.preventDefault();
        if (sentTo === null) send();
        else verify();
      }}
    >
      {sentTo === null ? (
        <label className="field">
          <span>شماره‌ی ادمین نقطه</span>
          <input
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09…"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
            }}
          />
        </label>
      ) : (
        <label className="field">
          <span>کدی که به {sentTo} پیامک شد</span>
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
            }}
          />
        </label>
      )}
      {error !== null && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      <div className="btn-row">
        <button type="submit" className="btn" disabled={busy}>
          {sentTo === null ? "فرستادن کد" : "ورود"}
        </button>
        {sentTo !== null && (
          <button
            type="button"
            className="btn ghost"
            disabled={busy || wait > 0}
            onClick={() => {
              setCode("");
              send();
            }}
          >
            {wait > 0 ? `کد تازه تا ${String(wait)} ثانیه‌ی دیگر` : "کد تازه"}
          </button>
        )}
      </div>
    </form>
  );
}

/** The whole page before signing in. */
export function SignInPage() {
  return (
    <main className="gate">
      <section className="card gate-card">
        <h1>ورود به NX Ads</h1>
        <p>
          فقط ادمین‌های نقطه، با همان کد پیامکی پنل نقطه. ورود فقط در همین تب می‌ماند و بعد از ۳۰
          دقیقه بی‌کاری تمام می‌شود.
        </p>
        <SignInForm />
      </section>
    </main>
  );
}
