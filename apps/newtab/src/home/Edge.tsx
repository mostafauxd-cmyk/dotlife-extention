import { useEffect, useState } from "react";

import { bookmarksBar, faviconUrl, type Bookmark } from "../platform";
import { Icon } from "../ui/Icon";

/**
 * The right edge: a short line; with the mouse on it a panel slides in with Chrome's own bookmarks
 * bar (folders open in place) and «شخصی‌سازی».
 */
export function Edge({
  showBookmarks,
  pinned,
  onCustomize,
}: {
  showBookmarks: boolean;
  pinned: boolean;
  onCustomize: () => void;
}) {
  const [bar, setBar] = useState<Bookmark[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (showBookmarks) void bookmarksBar().then(setBar);
  }, [showBookmarks]);

  const row = (b: Bookmark, sub = false) =>
    b.url !== undefined ? (
      <a key={b.id} href={b.url} className={sub ? "sub" : undefined}>
        <img src={faviconUrl(b.url, 32)} alt="" />
        <span>{b.title || b.url}</span>
      </a>
    ) : (
      <div key={b.id}>
        <button
          type="button"
          aria-expanded={open === b.id}
          onClick={() => {
            setOpen(open === b.id ? null : b.id);
          }}
        >
          <Icon name="folder" />
          <span>{b.title}</span>
        </button>
        {open === b.id && (b.children ?? []).map((c) => row(c, true))}
      </div>
    );

  return (
    <div className={pinned ? "edge pin" : "edge"} tabIndex={0} aria-label="بوکمارک‌ها و شخصی‌سازی">
      <span className="em" />
      <aside className="side2">
        {showBookmarks && (
          <>
            <div className="sec">بوکمارک‌های کروم</div>
            {bar.length === 0 ? (
              <div className="empty">نوار بوکمارک کروم خالی است.</div>
            ) : (
              <div className="bml">{bar.map((b) => row(b))}</div>
            )}
          </>
        )}
        <button
          type="button"
          className="ghost"
          style={{ alignSelf: "flex-start" }}
          onClick={onCustomize}
        >
          شخصی‌سازی
        </button>
      </aside>
    </div>
  );
}
