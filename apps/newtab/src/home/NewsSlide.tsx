import { useEffect, useMemo, useState } from "react";

import { addNote } from "../noghte/model";
import {
  NEWS_CATEGORIES,
  NEWS_SOURCES,
  useNews,
  useRead,
  type NewsCategory,
  type Story,
} from "../news";
import { useSettings } from "../hooks";
import { updateSettings, type Settings } from "../settings";
import { Icon } from "../ui/Icon";
import { Tabs } from "../ui/Tabs";
import { ago } from "../ui/fa";

/**
 * The news slide: a feed of headlines from the outlets' own RSS on one side, the chosen story on the
 * other — headline, summary, picture, and a link to the outlet's page for the rest. Which outlets are
 * read is the person's («منبع‌ها»); what was opened is dimmed.
 */

const sourceName = (id: string): string => NEWS_SOURCES.find((s) => s.id === id)?.name ?? "";
const categoryName = (c: NewsCategory): string =>
  NEWS_CATEGORIES.find(([id]) => id === c)?.[1] ?? "";

/** A story's picture; without one (or when it does not load) a list tile shows a newspaper, a hero is left out. */
function Thumb({ story, hero = false }: { story: Story; hero?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [story.image]);
  if (story.image === null || broken) {
    return hero ? null : (
      <span className="nw-th none" aria-hidden="true">
        <Icon name="newspaper" />
      </span>
    );
  }
  return (
    <img
      className={hero ? "nw-hero" : "nw-th"}
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
  const on = NEWS_SOURCES.filter((x) => !s.newsOff.includes(x.id)).map((x) => x.id);
  const { stories, loading, failed, refresh } = useNews(on);
  const { read, markRead } = useRead();
  const [cat, setCat] = useState<NewsCategory | "all">("all");
  const [pick, setPick] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const shown = useMemo(
    () => (cat === "all" ? stories : stories.filter((x) => x.category === cat)),
    [stories, cat],
  );
  const open = shown.find((x) => x.id === pick) ?? shown[0];

  const select = (x: Story): void => {
    setPick(x.id);
    markRead(x.id);
  };

  const save = (x: Story): void => {
    addNote(x.title, `${x.summary}\n${x.url}`.trim());
    setSaved(x.id);
  };

  return (
    <div className="s-pad news-s">
      <div className="nw-top">
        <h2>خبر</h2>
        <Tabs
          label="دسته‌ی خبر"
          value={cat}
          onChange={setCat}
          items={NEWS_CATEGORIES.map(([id, name]) => ({ id, label: name }))}
        />
        <span className="grow" />
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
        <button
          type="button"
          className="rbtn sm"
          aria-label="منبع‌ها"
          title="منبع‌ها"
          onClick={() => {
            setChoosing(true);
          }}
        >
          <Icon name="setting" />
        </button>
      </div>

      <div className="card g nw-feed">
        {shown.length === 0 ? (
          <div className="nw-none">
            {loading ? (
              <p>خبرها در راه است…</p>
            ) : on.length === 0 ? (
              <>
                <p>هیچ منبعی روشن نیست.</p>
                <button
                  type="button"
                  className="cta"
                  onClick={() => {
                    setChoosing(true);
                  }}
                >
                  انتخاب منبع‌ها
                </button>
              </>
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
          <div className="nw-list">
            {shown.map((x) => (
              <button
                key={x.id}
                type="button"
                className={read.has(x.id) ? "nw-row read" : "nw-row"}
                aria-current={open?.id === x.id}
                onClick={() => {
                  select(x);
                }}
              >
                <Thumb story={x} />
                <span className="nw-tx">
                  <b>{x.title}</b>
                  <small>
                    {sourceName(x.source)} · {ago(x.at)}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card g nw-read">
        {open === undefined ? (
          <div className="nw-none">
            <p>{loading ? "…" : "یک خبر را انتخاب کن."}</p>
          </div>
        ) : (
          <article>
            <Thumb story={open} hero />
            <div className="nw-meta">
              <span className="chip">{sourceName(open.source)}</span>
              <span className="chip">{categoryName(open.category)}</span>
              <span>{ago(open.at)}</span>
            </div>
            <h3>{open.title}</h3>
            {open.summary !== "" && <p>{open.summary}</p>}
            <div className="nw-acts">
              <a className="cta" href={open.url} target="_blank" rel="noreferrer">
                خواندن در {sourceName(open.source)}
              </a>
              <button
                type="button"
                className="ghost"
                disabled={saved === open.id}
                onClick={() => {
                  save(open);
                }}
              >
                {saved === open.id ? "در یادداشت‌ها ذخیره شد" : "ذخیره در یادداشت‌ها"}
              </button>
            </div>
          </article>
        )}
      </div>

      {choosing && (
        <Sources
          s={s}
          onClose={() => {
            setChoosing(false);
          }}
        />
      )}
    </div>
  );
}

function Sources({ s, onClose }: { s: Settings; onClose: () => void }) {
  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal sm" role="dialog" aria-modal="true" aria-labelledby="nwSrc">
        <div className="card-h">
          <h2 id="nwSrc">منبع‌های خبر</h2>
          <button type="button" className="rbtn sm" aria-label="بستن" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="slist">
          {NEWS_SOURCES.map((x) => {
            const on = !s.newsOff.includes(x.id);
            return (
              <button
                key={x.id}
                type="button"
                className="trow"
                aria-pressed={on}
                onClick={() => {
                  updateSettings({
                    newsOff: on ? [...s.newsOff, x.id] : s.newsOff.filter((i) => i !== x.id),
                  });
                }}
              >
                {x.name}
                <small className="nw-cat">{categoryName(x.category)}</small>
                <span className="sw" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
