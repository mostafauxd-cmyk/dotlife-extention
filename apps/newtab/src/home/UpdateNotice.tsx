import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { t } from "../i18n";
import { fa } from "../ui/fa";
import { Icon } from "../ui/Icon";
import {
  applyUpdate,
  checkNow,
  openExtensionsPage,
  seenDone,
  snooze,
  useUpdate,
  type Install,
} from "../update";

/**
 * What the page says about updates (`update.ts`): a bar at the top when a new version is waiting to
 * go in or is known to exist, a short line once it came, and «چطور به‌روز کنم؟» — the steps for
 * this kind of install.
 */
export function UpdateNotice() {
  const u = useUpdate();
  const [guide, setGuide] = useState(false);
  const [hidden, setHidden] = useState(false);

  // «به‌روز شد»: a few seconds, once
  useEffect(() => {
    if (u.done === null) return;
    const timer = setTimeout(() => void seenDone(), 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [u.done]);

  if (u.done !== null) {
    return (
      <div className="upd done" role="status">
        <Icon name="tick" />
        {t("نقطه به نسخه‌ی {v} به‌روز شد", { v: fa(u.done.to) })}
      </div>
    );
  }
  if (hidden) return null;

  if (u.ready !== null) {
    return (
      <div className="upd" role="status">
        <span>{t("نسخه‌ی تازه‌ی نقطه ({v}) آماده است", { v: fa(u.ready) })}</span>
        <button type="button" className="upd-go" onClick={() => void applyUpdate()}>
          {t("به‌روزرسانی")}
        </button>
        <button
          type="button"
          className="upd-x"
          aria-label={t("بعداً")}
          onClick={() => {
            setHidden(true);
          }}
        >
          <Icon name="close" />
        </button>
      </div>
    );
  }

  if (u.behind !== null) {
    const latest = u.behind.latest;
    return (
      <>
        <div className="upd" role="status">
          <span>{t("نسخه‌ی {v} نقطه آمده", { v: fa(latest) })}</span>
          <button
            type="button"
            className="upd-go"
            onClick={() => {
              setGuide(true);
            }}
          >
            {t("چطور به‌روز کنم؟")}
          </button>
          <button
            type="button"
            className="upd-x"
            aria-label={t("بعداً")}
            onClick={() => {
              setHidden(true);
              void snooze(latest);
            }}
          >
            <Icon name="close" />
          </button>
        </div>
        {guide && (
          <UpdateGuide
            install={u.install}
            latest={latest}
            downloadUrl={u.behind.downloadUrl}
            onClose={() => {
              setGuide(false);
            }}
          />
        )}
      </>
    );
  }
  return null;
}

function UpdateGuide({
  install,
  latest,
  downloadUrl,
  onClose,
}: {
  install: Install;
  latest: string;
  downloadUrl: string | null;
  onClose: () => void;
}) {
  const [check, setCheck] = useState<"idle" | "busy" | "none" | "failed">("idle");
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const manual = install === "manual";
  return createPortal(
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal upd-guide"
        role="dialog"
        aria-modal="true"
        aria-label={t("به‌روزرسانی نقطه")}
      >
        <div className="card-h">
          <h2>{t("به‌روزرسانی به نسخه‌ی {v}", { v: fa(latest) })}</h2>
          <button type="button" className="rbtn sm" aria-label={t("بستن")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        {manual ? (
          <>
            <p className="lead">
              {t("این نقطه از یک پوشه نصب شده و خودش به‌روز نمی‌شود. سه قدم تا نسخه‌ی تازه:")}
            </p>
            <ol className="steps">
              <li>
                <b>{t("نسخه‌ی تازه را بگیر")}</b>
                <span>{t("فایل زیپ را دانلود کن و باز کن.")}</span>
              </li>
              <li>
                <b>{t("جای پوشه‌ی قبلی بگذار")}</b>
                <span>
                  {t("محتوای پوشه‌ی تازه را روی همان پوشه‌ای بریز که نقطه از آن نصب شده.")}
                </span>
              </li>
              <li>
                <b>{t("در صفحه‌ی افزونه‌ها بارگذاری دوباره بزن")}</b>
                <span>
                  {t("کنار نقطه دکمه‌ی ↻ را بزن. کارها و یادداشت‌هایت سر جایشان می‌مانند.")}
                </span>
              </li>
            </ol>
            <div className="upd-actions">
              {downloadUrl !== null && (
                <a className="cta" href={downloadUrl} target="_blank" rel="noreferrer">
                  {t("دانلود نسخه‌ی تازه")}
                </a>
              )}
              <button type="button" className="cta ghost" onClick={openExtensionsPage}>
                {t("باز کردن صفحه‌ی افزونه‌ها")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="lead">
              {t(
                "کروم افزونه‌ها را خودش به‌روز می‌کند، ولی گاهی چند ساعت طول می‌کشد یا اینترنت جلویش را می‌گیرد.",
              )}
            </p>
            <ol className="steps">
              <li>
                <b>{t("یک بار «بررسی دوباره» را بزن")}</b>
                <span>{t("اگر نسخه‌ی تازه پیدا شود، همین‌جا نصبش می‌کنیم.")}</span>
              </li>
              <li>
                <b>{t("اگر نشد، از صفحه‌ی افزونه‌ها")}</b>
                <span>
                  {t(
                    "«حالت توسعه‌دهنده» (Developer mode) را بالای صفحه روشن کن و دکمه‌ی «به‌روزرسانی» (Update) را بزن.",
                  )}
                </span>
              </li>
            </ol>
            {check === "none" && (
              <p className="note">
                {t("کروم هنوز نسخه‌ی تازه را نمی‌بیند؛ قدم دوم را امتحان کن.")}
              </p>
            )}
            {check === "failed" && (
              <p className="note">{t("کروم به فروشگاه وصل نشد؛ قدم دوم را امتحان کن.")}</p>
            )}
            <div className="upd-actions">
              <button
                type="button"
                className="cta"
                disabled={check === "busy"}
                onClick={() => {
                  setCheck("busy");
                  void checkNow().then((r) => {
                    if (r === "found") void applyUpdate();
                    else setCheck(r);
                  });
                }}
              >
                {check === "busy" ? t("در حال بررسی…") : t("بررسی دوباره")}
              </button>
              <button type="button" className="cta ghost" onClick={openExtensionsPage}>
                {t("باز کردن صفحه‌ی افزونه‌ها")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.querySelector(".nt") ?? document.body,
  );
}
