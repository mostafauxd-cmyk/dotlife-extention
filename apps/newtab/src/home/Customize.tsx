import { useCallback, useEffect, useRef, useState } from "react";

import { INTERESTS } from "../cities";
import { useSession, useSettings, useSyncState } from "../hooks";
import { LANGS, t } from "../i18n";
import { allowEnglishNews } from "../news";
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
import { Tabs } from "../ui/Tabs";
import { CityPicker } from "./CityPicker";
import { PersonaPicker } from "./PersonaPicker";

type Pane = "me" | "page" | "look";

/**
 * «شخصی‌سازی», in three parts: «درباره‌ی من» (the account, persona, city, interests and the
 * sponsored boxes), «صفحه» (what shows on the first view and the slides) and «ظاهر» (the colour).
 */
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
  const [pane, setPane] = useState<Pane>("me");
  const body = useRef<HTMLDivElement>(null);
  return (
    <>
      {/* a click anywhere outside the panel closes it */}
      <div className={leaving ? "cust-bg out" : "cust-bg"} onMouseDown={onClose} />
      <aside className={leaving ? "cust out" : "cust"} aria-label={t("شخصی‌سازی")}>
        <div className="cust-h">
          <h2>{t("شخصی‌سازی")}</h2>
          <button type="button" className="rbtn" aria-label={t("بستن")} onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <Tabs
          label={t("بخش‌های شخصی‌سازی")}
          size="sm"
          block
          value={pane}
          onChange={(p) => {
            setPane(p);
            body.current?.scrollTo({ top: 0 });
          }}
          items={[
            { id: "me", label: t("درباره‌ی من") },
            { id: "page", label: t("صفحه") },
            { id: "look", label: t("ظاهر") },
          ]}
        />

        <div className="cust-body" ref={body} key={pane}>
          {pane === "me" && (
            <>
              <section className="cs">
                <h3>{t("زبان")}</h3>
                <div className="chint">{t("زبان همه‌ی نوشته‌های این صفحه.")}</div>
                <div className="ab-chips" role="group" aria-label={t("زبان")}>
                  {LANGS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={s.lang === l.id}
                      dir={l.dir}
                      lang={l.id}
                      onClick={() => {
                        updateSettings({ lang: l.id });
                        // the English outlets' sites, asked on this click (Chrome asks only then)
                        if (l.id === "en") void allowEnglishNews();
                      }}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </section>

              <section className="cs">
                <h3>{t("حساب نقطه")}</h3>
                {session === null ? (
                  <div className="acct">
                    {t("کارها و یادداشت‌ها با اپ نقطه یکی می‌شوند.")}
                    <button type="button" className="ghost" onClick={onSignIn}>
                      {t("ورود")}
                    </button>
                  </div>
                ) : (
                  <div className="acct">
                    <span>
                      <b>{fa(session.label)}</b>
                      <br />
                      <small style={{ color: "var(--ink-3)" }}>
                        {sync.lastAt === null
                          ? t("هنوز همگام نشده")
                          : t("همگام‌شده {when}", {
                              when: ago(new Date(sync.lastAt).toISOString()),
                            })}
                      </small>
                    </span>
                    <button type="button" className="ghost" onClick={() => void syncNow()}>
                      {t("همگام‌سازی")}
                    </button>
                    <button type="button" className="ghost" onClick={() => void signOut()}>
                      {t("خروج")}
                    </button>
                  </div>
                )}
              </section>

              <section className="cs">
                <h3>{t("کدام بیشتر شبیه توست؟")}</h3>
                <div className="chint">
                  {t(
                    "چند تا هم می‌شود؛ برای هر کدام پوشه‌ای از سایت‌هایش به دسترسی سریع زیر سرچ اضافه می‌شود.",
                  )}
                </div>
                <PersonaPicker />
              </section>

              <section className="cs">
                <h3>{t("شهر تو")}</h3>
                <div className="chint">
                  {t("برای رویدادها و پیشنهادهای نزدیک‌تر؛ اختیاری است.")}
                </div>
                <CityPicker />
              </section>

              <section className="cs">
                <h3>{t("علاقه‌هایت")}</h3>
                <div className="chint">{t("هر چند تا که خواستی؛ اختیاری است.")}</div>
                <div className="ab-chips" role="group" aria-label={t("علاقه‌ها")}>
                  {INTERESTS.map((tp) => (
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
                      {t(tp)}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {pane === "page" && (
            <>
              <section className="cs">
                <h3>{t("صفحه‌ی اول")}</h3>
                <div className="chint">
                  {t("صفحه‌ی اول فقط نقطه و سرچ است؛ بقیه در گوشه‌ها و لبه منتظرند.")}
                </div>
                <div className="tgrid">
                  {BLOCKS.filter(([id]) => id !== "ads").map(([id, name]) => (
                    <button
                      key={id}
                      type="button"
                      className="trow"
                      aria-pressed={isOn(s, id)}
                      onClick={() => {
                        toggleBlock(id);
                      }}
                    >
                      {t(name)}
                      <span className="sw" />
                    </button>
                  ))}
                </div>
              </section>

              <section className="cs">
                <h3>{t("اسلایدها")}</h3>
                <div className="chint">
                  {t("زیر صفحه‌ی اول، به همین ترتیب. خانه همیشه اول است.")}
                </div>
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
                        {t(SLIDES.find(([x]) => x === id)?.[1] ?? "")}
                        <span className="sw" />
                      </button>
                      <span className="smove">
                        <button
                          type="button"
                          aria-label={t("بالاتر")}
                          disabled={i === 0}
                          onClick={() => {
                            moveSlide(id, -1);
                          }}
                        >
                          <Icon name="arrow-up" />
                        </button>
                        <button
                          type="button"
                          aria-label={t("پایین‌تر")}
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
              </section>
            </>
          )}

          {pane === "look" && (
            <>
              <section className="cs">
                <h3>{t("رنگ پس‌زمینه")}</h3>
                <div className="wps">
                  {THEMES.map((th) => (
                    <button
                      key={th.id}
                      type="button"
                      className="wp"
                      aria-pressed={s.theme === th.id}
                      onClick={() => {
                        updateSettings({ theme: th.id });
                      }}
                    >
                      <i
                        style={{
                          background: `radial-gradient(circle at 50% 50%, ${th.tint} 0 16%, transparent 17%), radial-gradient(circle at 50% 45%, ${th.tint}33, transparent 70%), ${th.bg}`,
                        }}
                      />
                      {t(th.name)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="cs">
                <h3>{t("از نو")}</h3>
                <div className="chint">
                  {t(
                    "چیدمان صفحه، اسلایدها و رنگ را به حالت اول برمی‌گرداند؛ شهر و علاقه‌هایت هم پاک می‌شود.",
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      updateSettings({ ...DEFAULTS, lang: s.lang });
                    }}
                  >
                    {t("چیدمان پیش‌فرض")}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
