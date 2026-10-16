import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useSettings } from "../hooks";
import { faviconUrl, siteName, topSites, type Site } from "../platform";
import { updateSettings, type QuickSite } from "../settings";
import { Icon } from "../ui/Icon";

/**
 * The one row under the search box: the person's sites, each in a square frame tinted with its own
 * icon's colour, and «افزودن». Most-visited sites from Chrome are offered in the add window.
 */

/** An icon's pixels at 16×16, or null where the canvas may not read them. */
function pixels(src: string): Promise<Uint8ClampedArray | null> {
  return new Promise((done) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 16;
        c.height = 16;
        const g = c.getContext("2d", { willReadFrequently: true });
        if (g === null) {
          done(null);
          return;
        }
        g.drawImage(img, 0, 0, 16, 16);
        done(g.getImageData(0, 0, 16, 16).data);
      } catch {
        done(null);
      }
    };
    img.onerror = () => {
      done(null);
    };
    img.src = src;
  });
}

/** Chrome's grey globe, for a site it has no icon of yet (never visited in this browser). */
let globe: Promise<Uint8ClampedArray | null> | null = null;
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray): boolean =>
  a.length === b.length && a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 8);

type Look = { tint: string; letter: boolean };
const looks = new Map<string, Look>();

/** The tile's tint (the icon's main colour) and whether to show a letter instead of the globe. */
function useLook(src: string | null): Look | undefined {
  const [look, setLook] = useState(() => (src === null ? undefined : looks.get(src)));
  useEffect(() => {
    if (src === null) return;
    setLook(looks.get(src));
    if (looks.has(src)) return;
    globe ??= pixels(faviconUrl("https://no-icon.invalid/", 64));
    let live = true;
    void Promise.all([pixels(src), globe]).then(([d, g]) => {
      if (d === null || !live) return;
      let r = 0;
      let gr = 0;
      let b = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const pr = d[i] ?? 0;
        const pg = d[i + 1] ?? 0;
        const pb = d[i + 2] ?? 0;
        if ((d[i + 3] ?? 0) < 128 || Math.max(pr, pg, pb) - Math.min(pr, pg, pb) < 40) continue;
        r += pr;
        gr += pg;
        b += pb;
        n++;
      }
      // a black or white logo: a neutral frame
      const tint =
        n < 6
          ? "#C9CED8"
          : `rgb(${String(Math.round(r / n))} ${String(Math.round(gr / n))} ${String(Math.round(b / n))})`;
      const l = { tint, letter: g !== null && same(d, g) };
      looks.set(src, l);
      setLook(l);
    });
    return () => {
      live = false;
    };
  }, [src]);
  return src === null ? undefined : look;
}

/** The first letter of a name, as one grapheme (an emoji or a joined letter stays whole). */
function firstLetter(name: string): string {
  const seg = new Intl.Segmenter("fa", { granularity: "grapheme" }).segment(name.trim());
  return seg[Symbol.iterator]().next().value?.segment ?? "؟";
}

function Tile({ site, onRemove }: { site: QuickSite; onRemove: () => void }) {
  const src = faviconUrl(site.url, 64);
  const look = useLook(src);
  return (
    <a className="lt" href={site.url} aria-label={site.title}>
      <span
        className="ic"
        style={
          look !== undefined && !look.letter
            ? ({ "--bc": look.tint } as React.CSSProperties)
            : undefined
        }
      >
        {look?.letter === true ? (
          <span className="letter">{firstLetter(site.title)}</span>
        ) : (
          <img src={src} alt="" />
        )}
      </span>
      <span className="lb">{site.title}</span>
      <button
        type="button"
        className="x"
        aria-label={`برداشتن ${site.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
      >
        <Icon name="close" />
      </button>
    </a>
  );
}

export function Launcher() {
  const s = useSettings();
  const [adding, setAdding] = useState(false);
  return (
    <div className="launch">
      {s.sites.map((site) => (
        <Tile
          key={site.url}
          site={site}
          onRemove={() => {
            updateSettings({ sites: s.sites.filter((x) => x.url !== site.url) });
          }}
        />
      ))}
      <button
        type="button"
        className="lt"
        aria-label="افزودن به دسترسی سریع"
        onClick={() => {
          setAdding(true);
        }}
      >
        <span className="ic">
          <Icon name="plus" />
        </span>
        <span className="lb">افزودن</span>
      </button>
      {adding && (
        <AddSite
          have={s.sites}
          onClose={() => {
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

/** A typed address as a full URL, or null when it is not one yet. */
function typedUrl(raw: string): URL | null {
  const t = raw.trim();
  if (t === "") return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.includes(".") ? u : null;
  } catch {
    return null;
  }
}

/** The tile as it will look: نقطه's dot until the typed site's own icon arrives. */
function Preview({ url, title }: { url: string; title: string }) {
  // wait for a pause in typing, so every keystroke does not fetch an icon
  const [settled, setSettled] = useState<URL | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setSettled(typedUrl(url));
    }, 400);
    return () => {
      clearTimeout(t);
    };
  }, [url]);
  const src = settled === null ? null : faviconUrl(settled.href, 64);
  const look = useLook(src);
  // shown once the icon has loaded; Chrome's grey globe (no icon for this site) keeps the dot
  const [loaded, setLoaded] = useState<string | null>(null);
  const real = src !== null && loaded === src && look?.letter !== true;
  const name = title.trim() || (settled === null ? "" : siteName(settled.href));
  return (
    <div className="lt preview" aria-hidden="true">
      <span
        className="ic"
        style={real && look ? ({ "--bc": look.tint } as React.CSSProperties) : undefined}
      >
        <img key={real ? src : "dot"} src={real ? src : "./icons/dot.svg"} alt="" />
        {src !== null && !real && (
          <img
            hidden
            src={src}
            alt=""
            onLoad={() => {
              setLoaded(src);
            }}
          />
        )}
      </span>
      <span className="lb">{name || "سایت تازه"}</span>
    </div>
  );
}

/** Pick from the most visited sites, or type an address and a name. */
function AddSite({ have, onClose }: { have: readonly QuickSite[]; onClose: () => void }) {
  const [top, setTop] = useState<Site[]>([]);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    void topSites().then((sites) => {
      setTop(sites.slice(0, 12));
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const has = (u: string): boolean => have.some((h) => h.url === u);

  const toggle = (site: Site): void => {
    const next = has(site.url)
      ? have.filter((h) => h.url !== site.url)
      : [
          ...have,
          { title: site.title.split(/[-–|·]/)[0]?.trim() || siteName(site.url), url: site.url },
        ];
    updateSettings({ sites: next });
  };

  const addTyped = (): void => {
    if (url.trim() === "") return;
    const u = typedUrl(url);
    if (u === null) {
      setErr("این آدرس درست نیست.");
      return;
    }
    const site = { title: title.trim() || siteName(u.href), url: u.href };
    if (!has(site.url)) updateSettings({ sites: [...have, site] });
    onClose();
  };

  // over the whole page: inside the quick-access row it would be clipped to the row and moved by its entry animation
  return createPortal(
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal addsite" role="dialog" aria-modal="true" aria-labelledby="addTitle">
        <div className="card-h">
          <h2 id="addTitle">افزودن به دسترسی سریع</h2>
          <button type="button" className="rbtn" aria-label="بستن" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {top.length > 0 && (
          <>
            <p>سایت‌هایی که زیاد باز می‌کنی</p>
            <div className="sugg">
              {top.map((site) => (
                <button
                  key={site.url}
                  type="button"
                  className="sg"
                  aria-pressed={has(site.url)}
                  onClick={() => {
                    toggle(site);
                  }}
                >
                  <img src={faviconUrl(site.url, 64)} alt="" />
                  <span>{site.title || siteName(site.url)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <Preview url={url} title={title} />
        <form
          className="form2"
          onSubmit={(e) => {
            e.preventDefault();
            addTyped();
          }}
        >
          <label className="field">
            آدرس
            <input
              className="ltr"
              value={url}
              placeholder="example.com"
              autoFocus
              onChange={(e) => {
                setUrl(e.target.value);
                setErr("");
              }}
            />
          </label>
          <label className="field">
            نام (اختیاری)
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
            />
          </label>
          <button type="submit" hidden />
        </form>
        {err !== "" && <span className="err">{err}</span>}
        <button type="button" className="cta block" disabled={url.trim() === ""} onClick={addTyped}>
          افزودن
        </button>
      </div>
    </div>,
    document.querySelector(".nt") ?? document.body,
  );
}
