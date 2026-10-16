import { useEffect, useState } from "react";

import { useSettings } from "../hooks";
import { inExtension } from "../platform";
import { updateSettings, type Settings } from "../settings";
import { fa } from "../ui/fa";
import { Icon } from "../ui/Icon";

/**
 * «شبکه‌ها»: a large tablet frame with a tab per service — Telegram, Instagram, WhatsApp, X, Bale,
 * Rubika, Eitaa — each showing the service's own web page. Before a service's first use, a short
 * introduction says what it is and that signing in happens on the service's own page, once, and
 * stays in this Chrome; نقطه never sees the password or the messages. The services refuse to be
 * framed by other pages; the extension lifts that only for its own frames of these sites
 * (`public/frames.json`). Which services have a tab, and their order, are in «چیدمان شبکه‌ها».
 */

type Service = {
  id: string;
  name: string;
  color: string;
  letter: string;
  url: string;
  host: string;
  what: string;
  how: string;
};

export const SERVICES: readonly Service[] = [
  {
    id: "tg",
    name: "تلگرام",
    color: "#2AABEE",
    letter: "T",
    url: "https://web.telegram.org/a/",
    host: "web.telegram.org",
    what: "پیام‌ها، کانال‌ها و گروه‌هایت",
    how: "بدون باز کردن تب تازه",
  },
  {
    id: "ig",
    name: "اینستاگرام",
    color: "#DD2A7B",
    letter: "I",
    url: "https://www.instagram.com/",
    host: "instagram.com",
    what: "ریلز و دایرکت",
    how: "در یک قاب جمع‌وجور، بدون تب تازه",
  },
  {
    id: "wa",
    name: "واتس‌اپ",
    color: "#25D366",
    letter: "W",
    url: "https://web.whatsapp.com/",
    host: "web.whatsapp.com",
    what: "گفتگوهای واتس‌اپ",
    how: "با یک بار اسکن از گوشی",
  },
  {
    id: "x",
    name: "ایکس",
    color: "#000000",
    letter: "X",
    url: "https://x.com/",
    host: "x.com",
    what: "تایم‌لاین و پیام‌ها",
    how: "کنار بقیه‌ی شبکه‌ها",
  },
  {
    id: "bale",
    name: "بله",
    color: "#20A776",
    letter: "ب",
    url: "https://web.bale.ai/",
    host: "web.bale.ai",
    what: "گفتگوها، کانال‌ها و کیف پول بله",
    how: "همان حساب گوشی‌ات",
  },
  {
    id: "rubika",
    name: "روبیکا",
    color: "#7B3FE4",
    letter: "ر",
    url: "https://web.rubika.ir/",
    host: "web.rubika.ir",
    what: "پیام‌ها، کانال‌ها و ویترین روبیکا",
    how: "همان حساب گوشی‌ات",
  },
  {
    id: "eitaa",
    name: "ایتا",
    color: "#F08A24",
    letter: "ا",
    url: "https://web.eitaa.com/",
    host: "web.eitaa.com",
    what: "گفتگوها و کانال‌های ایتا",
    how: "همان حساب گوشی‌ات",
  },
];
const byId = new Map(SERVICES.map((v) => [v.id, v]));

const tabsOf = (s: Settings): Service[] =>
  s.social.order.filter((id) => s.social.shown.includes(id)).flatMap((id) => byId.get(id) ?? []);

export function SocialSlide() {
  const s = useSettings();
  const tabs = tabsOf(s);
  const [current, setCurrent] = useState(tabs[0]?.id ?? "tg");
  const [arranging, setArranging] = useState(false);
  // a frame is kept once opened, so going back to a tab does not load the service again
  const [opened, setOpened] = useState<string[]>([]);
  const svc = tabs.find((t) => t.id === current) ?? tabs[0];
  const seen = svc !== undefined && s.social.seen.includes(svc.id);

  useEffect(() => {
    if (svc !== undefined && seen && !opened.includes(svc.id)) setOpened([...opened, svc.id]);
  }, [svc, seen, opened]);

  const start = (id: string): void => {
    updateSettings({ social: { ...s.social, seen: [...s.social.seen, id] } });
  };

  return (
    <div className="s-pad social-s">
      <div className="soc-top">
        <h2>شبکه‌ها</h2>
        <div className="stabs morph" role="tablist" aria-label="سرویس‌ها">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === svc?.id}
              onClick={() => {
                setCurrent(t.id);
              }}
            >
              <span className={t.id === "x" ? "lg dark" : "lg"} style={{ background: t.color }}>
                {t.letter}
              </span>
              {t.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rbtn sm"
          aria-label="چیدمان شبکه‌ها"
          title="چیدمان شبکه‌ها"
          onClick={() => {
            setArranging(true);
          }}
        >
          <Icon name="setting" />
        </button>
      </div>

      <div className="tablet">
        {svc === undefined ? (
          <div className="tb-empty">
            <p>هیچ شبکه‌ای روشن نیست.</p>
            <button
              type="button"
              className="cta"
              onClick={() => {
                setArranging(true);
              }}
            >
              انتخاب شبکه‌ها
            </button>
          </div>
        ) : (
          <>
            <div className="tb-bar">
              <span className={svc.id === "x" ? "lg dark" : "lg"} style={{ background: svc.color }}>
                {svc.letter}
              </span>
              <b>{svc.name}</b>
              <span className="url">{svc.host}</span>
              <span className="grow" />
              <a
                className="rbtn sm"
                href={svc.url}
                target="_blank"
                rel="noreferrer"
                aria-label="باز کردن در تب جدا"
                title="باز کردن در تب جدا"
              >
                <Icon name="arrow-up" className="out" />
              </a>
            </div>
            <div className="tb-body">
              {!seen && (
                <Intro
                  svc={svc}
                  onStart={() => {
                    start(svc.id);
                  }}
                />
              )}
              {/* the frames opened so far stay alive behind each other */}
              {inExtension
                ? opened.map((id) => {
                    const v = byId.get(id);
                    if (v === undefined) return null;
                    return (
                      <iframe
                        key={id}
                        className="tb-frame"
                        src={v.url}
                        title={v.name}
                        hidden={id !== svc.id || !seen}
                        allow="clipboard-read; clipboard-write; microphone; camera; autoplay; fullscreen"
                      />
                    );
                  })
                : seen && (
                    <div className="tb-empty">
                      <p>{svc.name} فقط داخل افزونه در این قاب باز می‌شود.</p>
                    </div>
                  )}
            </div>
          </>
        )}
      </div>
      <div className="soc-note">
        ورود یک بار انجام می‌شود و تا وقتی خودت از خود سرویس خارج نشوی، در همین کروم می‌ماند. رمز و
        پیام‌هایت هیچ‌وقت به نقطه نمی‌رسد.
      </div>

      {arranging && (
        <Arrange
          s={s}
          onClose={() => {
            setArranging(false);
          }}
        />
      )}
    </div>
  );
}

function Intro({ svc, onStart }: { svc: Service; onStart: () => void }) {
  const dark = svc.id === "x";
  const tone = dark ? "#e7e9ea" : svc.color;
  const steps = [
    `ورود فقط یک بار، در صفحه‌ی خود ${svc.name}`,
    "رمز و پیام‌هایت هیچ‌وقت به نقطه نمی‌رسد",
    `هر وقت خواستی از خود ${svc.name} خارج شو`,
  ];
  return (
    <div className="sx-intro" style={{ "--sc": tone } as React.CSSProperties}>
      <div className="sx-copy">
        <span className="sx-kicker">
          <i />
          شبکه‌ها · {svc.name}
        </span>
        <h3>
          {svc.name}،
          <br />
          <em>همین‌جا</em> کنار کارهایت
        </h3>
        <p>
          {svc.what}، {svc.how}. هر وقت خواستی با یک اسکرول برمی‌گردی به صفحه‌ی اول.
        </p>
        <ol className="sx-steps">
          {steps.map((t, i) => (
            <li key={t}>
              <span>{fa(String(i + 1).padStart(2, "0"))}</span>
              {t}
            </li>
          ))}
        </ol>
        <button type="button" className="sx-cta" onClick={onStart}>
          ورود به {svc.name}
          <Icon name="arrow-left" />
        </button>
      </div>
      <div className="sx-art" aria-hidden="true">
        <span className="sx-grid" />
        <span className="sx-orb" />
        <span className="sx-bub b1">
          <i />
          <i />
        </span>
        <span className="sx-bub b2 me">
          <i />
        </span>
        <span className="sx-bub b3">
          <i />
          <i />
        </span>
        <span
          className={dark ? "sx-glyph dark" : "sx-glyph"}
          style={{ background: dark ? "#000" : svc.color }}
        >
          {svc.letter}
        </span>
      </div>
    </div>
  );
}

/** «چیدمان شبکه‌ها»: which services have a tab, and their order. */
function Arrange({ s, onClose }: { s: Settings; onClose: () => void }) {
  const order = s.social.order;
  const move = (id: string, by: -1 | 1): void => {
    const i = order.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j] ?? id, next[i] ?? id];
    updateSettings({ social: { ...s.social, order: next } });
  };
  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal sm" role="dialog" aria-modal="true" aria-labelledby="arrTitle">
        <div className="card-h">
          <h2 id="arrTitle">چیدمان شبکه‌ها</h2>
          <button type="button" className="rbtn sm" aria-label="بستن" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="slist">
          {order.map((id, i) => {
            const v = byId.get(id);
            if (v === undefined) return null;
            const on = s.social.shown.includes(id);
            return (
              <div key={id} className="srow3">
                <button
                  type="button"
                  className="trow"
                  aria-pressed={on}
                  onClick={() => {
                    updateSettings({
                      social: {
                        ...s.social,
                        shown: on
                          ? s.social.shown.filter((x) => x !== id)
                          : [...s.social.shown, id],
                      },
                    });
                  }}
                >
                  <span className={id === "x" ? "lg dark" : "lg"} style={{ background: v.color }}>
                    {v.letter}
                  </span>
                  {v.name}
                  <span className="sw" />
                </button>
                <span className="smove">
                  <button
                    type="button"
                    aria-label="بالاتر"
                    disabled={i === 0}
                    onClick={() => {
                      move(id, -1);
                    }}
                  >
                    <Icon name="arrow-up" />
                  </button>
                  <button
                    type="button"
                    aria-label="پایین‌تر"
                    disabled={i === order.length - 1}
                    onClick={() => {
                      move(id, 1);
                    }}
                  >
                    <Icon name="arrow-up" className="down" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
