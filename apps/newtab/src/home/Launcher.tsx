import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { useSettings } from "../hooks";
import { faviconUrl, siteName, topSites, type Site } from "../platform";
import {
  isFolder,
  updateSettings,
  type QuickFolder,
  type QuickItem,
  type QuickSite,
} from "../settings";
import { Icon } from "../ui/Icon";
import { cleanIcon } from "./iconClean";

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

/** The icon to draw: without its own plate and light enough for the dark tile, once that is worked out. */
function useClean(src: string | null): string | null {
  const [clean, setClean] = useState<{ src: string; url: string | null } | null>(null);
  useEffect(() => {
    if (src === null) return;
    let live = true;
    void cleanIcon(src).then((url) => {
      if (live) setClean({ src, url });
    });
    return () => {
      live = false;
    };
  }, [src]);
  if (src === null) return null;
  return clean?.src === src ? (clean.url ?? src) : src;
}

/** The first letter of a name, as one grapheme (an emoji or a joined letter stays whole). */
function firstLetter(name: string): string {
  const seg = new Intl.Segmenter("fa", { granularity: "grapheme" }).segment(name.trim());
  return seg[Symbol.iterator]().next().value?.segment ?? "؟";
}

function Tile({
  site,
  onRemove,
  removeLabel,
  drag,
}: {
  site: QuickSite;
  onRemove: () => void;
  removeLabel?: string;
  drag?: React.HTMLAttributes<HTMLElement> & { className?: string };
}) {
  const src = faviconUrl(site.url, 64);
  const look = useLook(src);
  const icon = useClean(src);
  const { className: dragClass, ...dragProps } = drag ?? {};
  return (
    <a
      className={dragClass === undefined ? "lt" : `lt ${dragClass}`}
      href={site.url}
      aria-label={site.title}
      {...dragProps}
    >
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
          <img src={icon ?? src} alt="" draggable={false} />
        )}
      </span>
      <span className="lb">{site.title}</span>
      <button
        type="button"
        className="x"
        aria-label={`${removeLabel ?? "برداشتن"} ${site.title}`}
        title={removeLabel}
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

/** A folder's tile: its first four sites' icons in a little grid, its name under it. */
function FolderTile({
  folder,
  onOpen,
  drag,
}: {
  folder: QuickFolder;
  onOpen: () => void;
  drag: React.HTMLAttributes<HTMLElement> & { className?: string };
}) {
  const { className: dragClass, ...dragProps } = drag;
  return (
    <button
      type="button"
      className={`lt fold ${dragClass ?? ""}`.trim()}
      aria-label={`پوشه‌ی ${folder.name}`}
      onClick={onOpen}
      {...dragProps}
    >
      <span className="ic fold">
        {folder.items.slice(0, 4).map((x) => (
          <img key={x.url} src={faviconUrl(x.url, 32)} alt="" draggable={false} />
        ))}
      </span>
      <span className="lb">{folder.name}</span>
    </button>
  );
}

const newFolderId = (): string =>
  `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * The row under the search box. Dropping a tile on another makes a folder of the two (named right
 * away); dropping one on a folder puts it in. A folder opens in the row itself: its name can be
 * changed there, a site can be taken out (back to the row) or added.
 */
export function Launcher() {
  const s = useSettings();
  const items = s.sites;
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [naming, setNaming] = useState(false);
  const folder = items.find((i): i is QuickFolder => isFolder(i) && i.id === open);
  const put = (next: QuickItem[]): void => {
    updateSettings({ sites: next });
  };

  const drop = (a: number, b: number): void => {
    const src = items[a];
    const dst = items[b];
    if (a === b || src === undefined || dst === undefined) return;
    // a folder moves to where it was dropped
    if (isFolder(src)) {
      const next = items.filter((_, i) => i !== a);
      next.splice(b, 0, src);
      put(next);
      return;
    }
    if (isFolder(dst)) {
      const inside = { ...dst, items: [...dst.items.filter((x) => x.url !== src.url), src] };
      put(items.flatMap((x, i) => (i === a ? [] : i === b ? [inside] : [x])));
      return;
    }
    const made: QuickFolder = {
      kind: "folder",
      id: newFolderId(),
      name: "پوشه‌ی تازه",
      items: [dst, src],
    };
    put(items.flatMap((x, i) => (i === a ? [] : i === b ? [made] : [x])));
    setOpen(made.id);
    setNaming(true);
  };

  const dragOf = (i: number) => ({
    className: [from === i ? "dragging" : "", over === i && from !== i ? "target" : ""]
      .join(" ")
      .trim(),
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setFrom(i);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (over !== i) setOver(i);
    },
    onDragLeave: () => {
      if (over === i) setOver(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (from !== null) drop(from, i);
      setFrom(null);
      setOver(null);
    },
    onDragEnd: () => {
      setFrom(null);
      setOver(null);
    },
  });

  if (folder !== undefined) {
    const at = items.indexOf(folder);
    const takeOut = (site: QuickSite): void => {
      const left = folder.items.filter((x) => x.url !== site.url);
      const next = items.flatMap((x) =>
        x === folder ? (left.length === 0 ? [site] : [{ ...folder, items: left }, site]) : [x],
      );
      put(next);
      if (left.length === 0) setOpen(null);
    };
    return (
      <div className="launch infolder">
        <div className="lt back">
          <button
            type="button"
            className="ic"
            aria-label="بستن پوشه"
            onClick={() => {
              setOpen(null);
              setNaming(false);
            }}
          >
            <Icon name="arrow-left" className="flip" />
          </button>
          <input
            className="fname-in"
            value={folder.name}
            aria-label="اسم پوشه"
            autoFocus={naming}
            onFocus={(e) => {
              if (naming) e.currentTarget.select();
            }}
            onChange={(e) => {
              put(items.map((x, i) => (i === at ? { ...folder, name: e.target.value } : x)));
            }}
            onBlur={() => {
              setNaming(false);
              if (folder.name.trim() === "")
                put(items.map((x, i) => (i === at ? { ...folder, name: "پوشه" } : x)));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
          />
        </div>
        {folder.items.map((site) => (
          <Tile
            key={site.url}
            site={site}
            removeLabel="بیرون آوردن از پوشه"
            onRemove={() => {
              takeOut(site);
            }}
          />
        ))}
        <button
          type="button"
          className="lt"
          aria-label="افزودن به این پوشه"
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
            folderId={folder.id}
            onClose={() => {
              setAdding(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="launch">
      {items.map((item, i) =>
        isFolder(item) ? (
          <FolderTile
            key={item.id}
            folder={item}
            drag={dragOf(i)}
            onOpen={() => {
              setOpen(item.id);
            }}
          />
        ) : (
          <Tile
            key={item.url}
            site={item}
            drag={dragOf(i)}
            onRemove={() => {
              put(items.filter((_, k) => k !== i));
            }}
          />
        ),
      )}
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
          folderId={null}
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
  const icon = useClean(src);
  const name = title.trim() || (settled === null ? "" : siteName(settled.href));
  return (
    <div className="lt preview" aria-hidden="true">
      <span
        className="ic"
        style={real && look ? ({ "--bc": look.tint } as React.CSSProperties) : undefined}
      >
        <img key={real ? src : "dot"} src={real ? (icon ?? src) : "./icons/dot.svg"} alt="" />
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
function AddSite({ folderId, onClose }: { folderId: string | null; onClose: () => void }) {
  const s = useSettings();
  const folder = s.sites.find((i): i is QuickFolder => isFolder(i) && i.id === folderId);
  // where a pick goes: the open folder, or the row itself
  const have: QuickSite[] = folder?.items ?? s.sites.filter((i): i is QuickSite => !isFolder(i));
  const store = (next: QuickSite[]): void => {
    if (folder === undefined) {
      const folders = s.sites.filter(isFolder);
      const order = s.sites.filter((i) => isFolder(i) || next.some((x) => x.url === i.url));
      const added = next.filter((x) => !order.some((o) => !isFolder(o) && o.url === x.url));
      updateSettings({
        sites: [...order, ...added].filter((i) => (isFolder(i) ? folders.includes(i) : true)),
      });
    } else {
      updateSettings({
        sites: s.sites.map((i) => (i === folder ? { ...folder, items: next } : i)),
      });
    }
  };
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
    store(next);
  };

  const addTyped = (): void => {
    if (url.trim() === "") return;
    const u = typedUrl(url);
    if (u === null) {
      setErr("این آدرس درست نیست.");
      return;
    }
    const site = { title: title.trim() || siteName(u.href), url: u.href };
    if (!has(site.url)) store([...have, site]);
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
