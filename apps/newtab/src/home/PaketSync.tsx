import { useEffect, useState } from "react";

import { t } from "../i18n";
import { getLink, installId } from "../install";
import { formatCode, linkPaket, PaketError } from "../paket";
import { Qr } from "../ui/Qr";

/** What the person is told when linking fails, by Paket's error code. */
export const REASONS: Record<string, string> = {
  INVALID_PAIRING_CODE: "این کد درست نیست یا وقتش گذشته؛ از گوشی کد تازه بگیر.",
  TOO_MANY_REQUESTS: "چند بار پشت هم امتحان شد؛ یک دقیقه صبر کن.",
  VALIDATION_ERROR: "کد هشت‌حرفی را کامل بنویس.",
  offline: "به پاکت وصل نشد. اینترنت را بررسی کن.",
};

export function PaketLogo({ size = 52 }: { size?: number }) {
  return (
    <img
      className="pk-logo"
      src="./brands/paket.svg"
      alt={t("پاکت")}
      width={size}
      height={size}
      draggable={false}
    />
  );
}

/**
 * Takes the place of the cards that come from Paket while it is not linked — the balance, the
 * month's spending — and says how to link: the code from the phone's «تنظیمات ← دستگاه‌ها و افزونه»,
 * typed here, and a QR to get Paket. The market and the news beside it work without it.
 */
export function PaketSync({
  embedded = false,
  lead,
}: {
  /** Inside a sheet that carries the title and the logo itself. */
  embedded?: boolean;
  /** The paragraph under the title, when the place has its own words. */
  lead?: string;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [install, setInstall] = useState<string | null>(null);
  useEffect(() => {
    void installId().then(setInstall);
  }, []);
  const ready = code.length === 9;
  const link = async (): Promise<void> => {
    setBusy(true);
    setErr("");
    try {
      await linkPaket(code);
    } catch (e) {
      setErr(t(REASONS[e instanceof PaketError ? e.code : ""] ?? "وصل نشد؛ دوباره امتحان کن."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card g pk-empty">
      <div className="pke-copy">
        {!embedded && <PaketLogo />}
        {!embedded && <h2>{t("پول‌هایت را هم همین‌جا ببین")}</h2>}
        <p>
          {t(
            lead ??
              "پاکت را به این صفحه وصل کن تا موجودی، بودجه‌ی ماه، آخرین خرج‌ها، قبض‌های پیش رو و بدهی و طلبت روی هر تب تازه دیده شود. فقط خواندنی است؛ از این‌جا چیزی در پاکت عوض نمی‌شود.",
          )}
        </p>
        <ol className="pke-steps">
          <li>{t("پاکت را روی گوشی باز کن.")}</li>
          <li>
            {t("برو به")} <b>{t("تنظیمات ← دستگاه‌ها و افزونه")}</b> {t("و «اتصال افزونه» را بزن.")}
          </li>
          <li>{t("کد هشت‌حرفی‌ای را که نشان می‌دهد این‌جا بنویس.")}</li>
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
            aria-label={t("کد پاکت")}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setCode(formatCode(e.target.value));
              setErr("");
            }}
          />
          <button type="submit" className="cta" disabled={!ready || busy}>
            {busy ? t("در حال وصل شدن…") : t("وصل شو")}
          </button>
        </form>
        {err !== "" && <p className="pke-err">{err}</p>}
      </div>
      {install !== null && (
        <div className="pke-qr">
          <Qr
            text={getLink("paket", "money-slide", install)}
            label={t("کد صفحه‌ی پاکت (paket.life)")}
          />
          <b>{t("پاکت را نداری؟")}</b>
          <small>{t("با دوربین گوشی اسکن کن تا پاکت را ببینی و نصبش کنی.")}</small>
        </div>
      )}
    </div>
  );
}
