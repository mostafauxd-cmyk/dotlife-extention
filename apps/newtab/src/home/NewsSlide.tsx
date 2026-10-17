import { useEffect, useMemo, useState } from "react";

import { AD_LABEL, useAd } from "../ads";
import { useRecordsVersion, useSettings } from "../hooks";
import {
  categoryName,
  checkOwnFeed,
  coverage,
  forYou,
  hottest,
  NEWS_CATEGORIES,
  NEWS_SOURCES,
  ownToSource,
  useNews,
  useRead,
  type NewsCategory,
  type NewsSource,
  type Story,
} from "../news";
import { savedNoteOf, savedNotes, toggleSaved } from "../newsSaved";
import { updateSettings } from "../settings";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/Tabs";
import { ago, fa } from "../ui/fa";

import { openNote } from "./openNote";

/**
 * The news slide, three columns: «منبع‌های من» (which outlets are read, and one more by its RSS
 * address), the feed (search, «برای تو» or «تازه‌ترین», categories, the top story and the rest, a
 * sponsored card among them), and «داغ‌ترین امروز» with the stories saved for later. A click on a
 * story goes to the outlet's own page.
 */

const GROUPS: readonly (readonly [NewsSource["group"], string])[] = [
  ["domestic", "داخلی"],
  ["paket", "پاکت"],
  ["own", "منبع‌های خودت"],
];

const norm = (s: string): string =>
  s.replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ").toLowerCase();

/** The outlet's own icon, or its first letter on its colour (also when the icon does not load). */
function Badge({ source }: { source: NewsSource | undefined }) {
  const [broken, setBroken] = useState(false);
  const icon = source?.icon ?? null;
  if (icon !== null && !broken) {
    return (
      <img
        className="nw-b"
        src={icon}
        alt=""
        draggable={false}
        onError={() => {
          setBroken(true);
        }}
      />
    );
  }
  return (
    <i className="nw-b" style={{ background: source?.color ?? "#6d6d6d" }} aria-hidden="true">
      {source?.name.slice(0, 1) ?? "؟"}
    </i>
  );
}

/** A story's picture, or its outlet's colour when there is none (or it does not load). */
function Pic({
  story,
  source,
  className,
}: {
  story: Story;
  source: NewsSource | undefined;
  className: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [story.image]);
  if (story.image === null || broken) {
    return (
      <span
        className={`${className} none`}
        style={{ "--sc": source?.color ?? "#6d6d6d" } as React.CSSProperties}
        aria-hidden="true"
      />
    );
  }
  return (
    <img
      className={className}
      src={story.image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        setBroken(true);
      }}
    />
  );
}

export function NewsSlide() {
  const s = useSettings();
  useRecordsVersion();
  const all = useMemo(() => [...NEWS_SOURCES, ...s.newsOwn.map(ownToSource)], [s.newsOwn]);
  const active = useMemo(() => all.filter((x) => !s.newsOff.includes(x.id)), [all, s.newsOff]);
  const { stories, loading, failed, refresh } = useNews(active);
  const { read, markRead } = useRead();
  const covered = useMemo(() => coverage(stories), [stories]);
  const [mode, setMode] = useState<"you" | "latest">("you");
  const [cat, setCat] = useState<NewsCategory | "all">("all");
  const [q, setQ] = useState("");
  const ad = useAd(12);
  const src = (id: string): NewsSource | undefined => all.find((x) => x.id === id);

  const shown = useMemo(() => {
    const needle = norm(q.trim());
    const found = stories.filter(
      (x) =>
        (cat === "all" || x.category === cat) &&
        (needle === "" || norm(`${x.title} ${x.summary}`).includes(needle)),
    );
    return mode === "you" ? forYou(found, { topics: s.topics, read, covered }) : found;
  }, [stories, cat, q, mode, s.topics, read, covered]);
  const top = shown[0];
  const rest = shown.slice(1, 60);
  const hot = useMemo(() => hottest(stories, covered), [stories, covered]);
  const saved = savedNotes();

  const card = (x: Story) => (
    <div key={x.id} className={read.has(x.id) ? "nw-card read" : "nw-card"}>
      <a
        href={x.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          markRead(x.id);
        }}
      >
        <Pic story={x} source={src(x.source)} className="nw-pic" />
        <span className="nw-body">
          <Meta story={x} source={src(x.source)} />
          <b>{x.title}</b>
          {x.summary !== "" && <span className="nw-sum">{x.summary}</span>}
        </span>
      </a>
      <SaveButton story={x} on={savedNoteOf(x.url) !== undefined} />
    </div>
  );

  const twins = top === undefined ? [] : (covered.get(top.id) ?? []);

  return (
    <div className="s-pad news-s">
      <Sources all={all} off={s.newsOff} />

      <section className="card g nw-feed" aria-label="خبرها">
        <div className="nw-bar">
          <Tabs
            label="ترتیب خبرها"
            size="sm"
            value={mode}
            onChange={setMode}
            items={[
              { id: "you", label: "برای تو" },
              { id: "latest", label: "تازه‌ترین" },
            ]}
          />
          <label className="nw-search">
            <Icon name="search" />
            <input
              value={q}
              placeholder="جستجو در خبرها…"
              aria-label="جستجو در خبرها"
              onChange={(e) => {
                setQ(e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="rbtn sm"
            aria-label="خبر تازه بگیر"
            title="خبر تازه بگیر"
            disabled={loading}
            onClick={refresh}
          >
            <Icon name="refresh" />
          </button>
        </div>
        <div className="nw-chips" role="tablist" aria-label="دسته‌ی خبر">
          {NEWS_CATEGORIES.map(([id, name]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="chip"
              aria-selected={cat === id}
              onClick={() => {
                setCat(id);
              }}
            >
              {name}
            </button>
          ))}
        </div>

        <div className="nw-scroll">
          {top === undefined ? (
            <div className="nw-none">
              {loading ? (
                <p>خبرها در راه است…</p>
              ) : active.length === 0 ? (
                <p>هیچ منبعی روشن نیست؛ از ستون کناری یکی را روشن کن.</p>
              ) : q !== "" ? (
                <p>خبری با این کلمه پیدا نشد.</p>
              ) : (
                <>
                  <p>{failed ? "الان به خبرها نمی‌رسم." : "در این دسته خبری نیست."}</p>
                  {failed && (
                    <button type="button" className="cta" onClick={refresh}>
                      دوباره
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className={read.has(top.id) ? "nw-top read" : "nw-top"}>
                <a
                  href={top.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    markRead(top.id);
                  }}
                >
                  <Pic story={top} source={src(top.source)} className="nw-himg" />
                  <span className="nw-htx">
                    <Meta story={top} source={src(top.source)} big />
                    <b>{top.title}</b>
                    {top.summary !== "" && <span className="nw-sum">{top.summary}</span>}
                  </span>
                </a>
                <SaveButton story={top} on={savedNoteOf(top.url) !== undefined} />
                {twins.length > 0 && (
                  <div className="nw-twins">
                    <span>همین خبر در {fa(twins.length)} منبع دیگر:</span>
                    {twins.slice(0, 4).map((t) => (
                      <a key={t.id} className="chip" href={t.url} target="_blank" rel="noreferrer">
                        <Badge source={src(t.source)} />
                        {src(t.source)?.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {rest.map((x, i) => (
                <div key={x.id} className="nw-slot">
                  {card(x)}
                  {i === 2 && ad !== null && (
                    <a className="nw-card nw-ad" href={ad.url} target="_blank" rel="noreferrer">
                      <span
                        className="nw-pic none"
                        style={{ "--sc": ad.tint ?? "#8C9EFF" } as React.CSSProperties}
                        aria-hidden="true"
                      />
                      <span className="nw-body">
                        <span className="nw-meta">
                          <span className="chip">{AD_LABEL}</span>
                          <small>{ad.line}</small>
                        </span>
                        <b>{ad.title}</b>
                        {ad.cta !== undefined && <span className="nw-sum">{ad.cta} ←</span>}
                      </span>
                    </a>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      <aside className="nw-side" aria-label="داغ‌ترین و ذخیره‌شده‌ها">
        <div className="card g nw-hot">
          <h2>داغ‌ترین امروز</h2>
          {hot.length === 0 ? (
            <p className="nw-empty">{loading ? "…" : "هنوز خبری نیست."}</p>
          ) : (
            <ol>
              {hot.map((x, i) => (
                <li key={x.id}>
                  <a
                    href={x.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      markRead(x.id);
                    }}
                  >
                    <em>{fa(i + 1)}</em>
                    <span>
                      <b>{x.title}</b>
                      <small>{src(x.source)?.name}</small>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="card g nw-saved">
          <h3>{fa(saved.length)} خبر ذخیره‌شده</h3>
          <p>برای بعد؛ روی گوشی هم در اپ نقطه هست.</p>
          {saved.slice(0, 3).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                openNote(n.id);
              }}
            >
              {n.blocks.find((b) => b.kind === "title")?.text}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Meta({
  story,
  source,
  big = false,
}: {
  story: Story;
  source: NewsSource | undefined;
  big?: boolean;
}) {
  return (
    <span className={big ? "nw-meta big" : "nw-meta"}>
      <Badge source={source} />
      <b>{source?.name}</b>
      <small>
        {categoryName(story.category)} · {ago(story.at)}
      </small>
    </span>
  );
}

function SaveButton({ story, on }: { story: Story; on: boolean }) {
  return (
    <button
      type="button"
      className={on ? "nw-save on" : "nw-save"}
      aria-pressed={on}
      aria-label={on ? "از ذخیره‌شده‌ها بردار" : "ذخیره برای بعد"}
      title={on ? "از ذخیره‌شده‌ها بردار" : "ذخیره برای بعد"}
      onClick={() => {
        toggleSaved(story);
      }}
    >
      <Icon name="bookmark" />
    </button>
  );
}

function Sources({ all, off }: { all: readonly NewsSource[]; off: readonly string[] }) {
  const s = useSettings();
  const [adding, setAdding] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState("");

  const toggle = (id: string): void => {
    updateSettings({ newsOff: off.includes(id) ? off.filter((x) => x !== id) : [...off, id] });
  };

  const add = (): void => {
    if (busy || address.trim() === "") return;
    setBusy(true);
    setWhy("");
    // called straight from the click: Chrome asks for the site's permission only then
    void checkOwnFeed(address).then((r) => {
      setBusy(false);
      if (!r.ok) {
        setWhy(r.why);
        return;
      }
      if (!s.newsOwn.some((o) => o.id === r.source.id)) {
        updateSettings({ newsOwn: [...s.newsOwn, r.source] });
      }
      setAddress("");
      setAdding(false);
    });
  };

  return (
    <section className="card g nw-src" aria-label="منبع‌های من">
      <h2>منبع‌های من</h2>
      <p className="nw-lead">هر رسانه روایت خودش را دارد. خودت انتخاب کن از کدام‌ها خبر بخوانی.</p>
      <div className="nw-groups">
        {GROUPS.map(([group, name]) => {
          const rows = all.filter((x) => x.group === group);
          if (rows.length === 0) return null;
          return (
            <div key={group} className="nw-group">
              <h4>{name}</h4>
              {rows.map((x) => (
                <div key={x.id} className="nw-srow">
                  <button
                    type="button"
                    aria-pressed={!off.includes(x.id)}
                    onClick={() => {
                      toggle(x.id);
                    }}
                  >
                    <Badge source={x} />
                    <span>{x.name}</span>
                    <span className="sw" />
                  </button>
                  {x.group === "own" && (
                    <button
                      type="button"
                      className="nw-x"
                      aria-label={`حذف ${x.name}`}
                      onClick={() => {
                        updateSettings({
                          newsOwn: s.newsOwn.filter((o) => o.id !== x.id),
                          newsOff: off.filter((i) => i !== x.id),
                        });
                      }}
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {adding ? (
        <form
          className="nw-add open"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            autoFocus
            dir="ltr"
            value={address}
            placeholder="https://example.com/feed"
            aria-label="آدرس RSS"
            onChange={(e) => {
              setAddress(e.target.value);
            }}
          />
          <button type="submit" className="cta" disabled={busy || address.trim() === ""}>
            {busy ? "…" : "افزودن"}
          </button>
          {why !== "" && <p role="alert">{why}</p>}
        </form>
      ) : (
        <button
          type="button"
          className="nw-add"
          onClick={() => {
            setAdding(true);
          }}
        >
          <Icon name="plus" />
          منبع دلخواه با آدرس RSS
        </button>
      )}
    </section>
  );
}
