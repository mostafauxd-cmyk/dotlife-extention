import { useCallback, useEffect, useRef, useState } from "react";

import { AD_CITIES, AD_TOPICS } from "@dotlife/ads";

import { useSession, useSettings, useSyncState } from "../hooks";
import { signOut } from "../noghte/api";
import { syncNow } from "../noghte/sync";
import {
  BLOCKS,
  DEFAULTS,
  isOn,
  moveSlide,
  orderedSlides,
  SLIDES,
  THEMES,
  toggleBlock,
  updateSettings,
} from "../settings";
import { ago, fa } from "../ui/fa";
import { Icon } from "../ui/Icon";
import { PersonaPicker } from "./PersonaPicker";

/** «شخصی‌سازی»: the colour, what shows on the first view, and the نقطه account. */
export function Customize({
  onClose: closed,
  onSignIn,
}: {
  onClose: () => void;
  onSignIn: () => void;
}) {
  // the panel slides in from the left and leaves the same way; it is gone from the page only after
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onClose = useCallback((): void => {
    if (timer.current !== undefined) return;
    setLeaving(true);
    timer.current = setTimeout(closed, 300);
  }, [closed]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const s = useSettings();
  const session = useSession();
  const sync = useSyncState();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <>
      {/* a click anywhere outside the panel closes it */}
      <div className={leaving ? "cust-bg out" : "cust-bg"} onMouseDown={onClose} />
      <aside className={leaving ? "cust out" : "cust"} aria-label="شخصی‌سازی">
        <div className="cust-h">
          <h2>شخصی‌سازی</h2>
          <button type="button" className="rbtn" aria-label="بستن" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        <h3>حساب نقطه</h3>
        {session === null ? (
          <div className="acct">
            کارها و یادداشت‌ها با اپ نقطه یکی می‌شوند.
            <button type="button" className="ghost" onClick={onSignIn}>
              ورود
            </button>
          </div>
        ) : (
          <div className="acct">
            <span>
              <b>{fa(session.label)}</b>
              <br />
              <small style={{ color: "var(--ink-3)" }}>
                {sync.lastAt === null
                  ? "هنوز همگام نشده"
                  : `همگام‌شده ${ago(new Date(sync.lastAt).toISOString())}`}
              </small>
            </span>
            <button type="button" className="ghost" onClick={() => void syncNow()}>
              همگام‌سازی
            </button>
            <button type="button" className="ghost" onClick={() => void signOut()}>
              خروج
            </button>
          </div>
        )}

        <h3>کدام بیشتر شبیه توست؟</h3>
        <div className="chint">
          پوشه‌ای از سایت‌های همین کار به دسترسی سریع زیر سرچ اضافه می‌شود.
        </div>
        <PersonaPicker />

        <h3>برای پیشنهادهای بهتر (اختیاری)</h3>
        <div className="chint">
          فقط برای انتخاب «معرفی‌شده»ها؛ روی همین دستگاه می‌ماند و جایی فرستاده نمی‌شود.
        </div>
        <div className="ab-chips" role="group" aria-label="شهر">
          <span>شهر</span>
          {AD_CITIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={s.city === c}
              onClick={() => {
                updateSettings({ city: s.city === c ? null : c });
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ab-chips" role="group" aria-label="موضوع‌ها">
          <span>علاقه‌ها</span>
          {AD_TOPICS.map((tp) => (
            <button
              key={tp}
              type="button"
              aria-pressed={s.topics.includes(tp)}
              onClick={() => {
                updateSettings({
                  topics: s.topics.includes(tp)
                    ? s.topics.filter((x) => x !== tp)
                    : [...s.topics, tp],
                });
              }}
            >
              {tp}
            </button>
          ))}
        </div>

        <h3>صفحه‌ی اول</h3>
        <div className="chint">صفحه‌ی اول فقط نقطه و سرچ است؛ بقیه در گوشه‌ها و لبه منتظرند.</div>
        <div className="tgrid">
          {BLOCKS.map(([id, name]) => (
            <button
              key={id}
              type="button"
              className="trow"
              aria-pressed={isOn(s, id)}
              onClick={() => {
                toggleBlock(id);
              }}
            >
              {name}
              <span className="sw" />
            </button>
          ))}
        </div>

        <h3>اسلایدها</h3>
        <div className="chint">زیر صفحه‌ی اول، به همین ترتیب. خانه همیشه اول است.</div>
        <div className="slist">
          {orderedSlides(s).map((id, i, all) => (
            <div key={id} className="srow3">
              <button
                type="button"
                className="trow"
                aria-pressed={isOn(s, id)}
                onClick={() => {
                  toggleBlock(id);
                }}
              >
                {SLIDES.find(([x]) => x === id)?.[1]}
                <span className="sw" />
              </button>
              <span className="smove">
                <button
                  type="button"
                  aria-label="بالاتر"
                  disabled={i === 0}
                  onClick={() => {
                    moveSlide(id, -1);
                  }}
                >
                  <Icon name="arrow-up" />
                </button>
                <button
                  type="button"
                  aria-label="پایین‌تر"
                  disabled={i === all.length - 1}
                  onClick={() => {
                    moveSlide(id, 1);
                  }}
                >
                  <Icon name="arrow-up" className="down" />
                </button>
              </span>
            </div>
          ))}
        </div>

        <h3>رنگ پس‌زمینه</h3>
        <div className="wps">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="wp"
              aria-pressed={s.theme === t.id}
              onClick={() => {
                updateSettings({ theme: t.id });
              }}
            >
              <i
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${t.tint} 0 16%, transparent 17%), radial-gradient(circle at 50% 45%, ${t.tint}33, transparent 70%), ${t.bg}`,
                }}
              />
              {t.name}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              updateSettings({ ...DEFAULTS });
            }}
          >
            چیدمان پیش‌فرض
          </button>
        </div>
      </aside>
    </>
  );
}
