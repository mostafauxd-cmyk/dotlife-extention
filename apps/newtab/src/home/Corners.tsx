import { useState, type ReactNode } from "react";

import { useNow, useRecordsVersion, useSyncState } from "../hooks";
import {
  addNote,
  addTask,
  isDone,
  liveLists,
  liveNotes,
  liveTasks,
  noteSnippet,
  noteTitle,
  todayRows,
  toggleTask,
} from "../noghte/model";
import { todayInfo } from "../today";
import { ago, fa } from "../ui/fa";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/icons";

/**
 * The four corners of the first view: a faint mark in each; the card slides in when the mouse
 * reaches it, stays while the mouse is on it, and opens by itself for a few seconds when something
 * new arrives from the phone («از گوشی · همین حالا»).
 */

export type Peek = { label: string; keys: ReadonlySet<string> } | null;

export function Corner({
  pos,
  icon,
  label,
  pinned,
  peek,
  dot,
  children,
}: {
  pos: "tr" | "tl" | "br" | "bl";
  icon: IconName;
  label: string;
  pinned: boolean;
  peek: Peek;
  dot: boolean;
  children: ReactNode;
}) {
  const cls = ["hz", `c-${pos}`, pinned ? "pin" : "", peek !== null ? "livep" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} tabIndex={0} aria-label={label}>
      <span className={dot ? "cmk has" : "cmk"} title={label}>
        <Icon name={icon} />
      </span>
      <span className="cl">{label}</span>
      <div className="ccard">
        {peek !== null && (
          <div className="ping">
            <i />
            {peek.label}
            <span className="ptimer">
              <b />
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function SyncBadge() {
  const s = useSyncState();
  const text =
    s.status === "syncing"
      ? "در حال همگام‌سازی"
      : s.status === "offline"
        ? "آفلاین · بعداً می‌فرستم"
        : s.status === "error"
          ? "همگام نشد"
          : "همگام با گوشی";
  return (
    <span className={`sync ${s.status}`}>
      <i />
      {text}
    </span>
  );
}

function SignInHint({ what, onSignIn }: { what: string; onSignIn: () => void }) {
  return (
    <div className="signin-cta">
      {what} از اپ نقطه این‌جا می‌آیند و هر چه این‌جا بنویسی روی گوشی هم هست.
      <button type="button" className="cta" onClick={onSignIn}>
        ورود به نقطه
      </button>
    </div>
  );
}

const timeOf = (r: ReturnType<typeof todayRows>[number]): string => {
  const s = r.occurrence?.schedule;
  if (s === undefined) return "";
  const p = s.kind === "due" ? s.due : s.start;
  return p.time !== undefined ? fa(p.time) : "";
};

export function TasksCard({
  signedIn,
  fresh,
  onSignIn,
}: {
  signedIn: boolean;
  fresh: ReadonlySet<string>;
  onSignIn: () => void;
}) {
  useRecordsVersion();
  const [draft, setDraft] = useState("");
  if (!signedIn) {
    return (
      <>
        <h3>کارهای امروز</h3>
        <SignInHint what="کارهای امروزت" onSignIn={onSignIn} />
      </>
    );
  }
  const lists = new Map(liveLists().map((l) => [l.id, l]));
  const rows = todayRows(liveTasks());
  return (
    <>
      <h3>
        کارهای امروز <SyncBadge />
      </h3>
      {rows.length === 0 ? (
        <div className="empty">برای امروز کاری نیست.</div>
      ) : (
        <ul className="tasks">
          {rows.map((r) => {
            const done = isDone(r);
            const key = `${r.task.id}@${r.occurrence?.originalDate ?? ""}`;
            return (
              <li
                key={key}
                className={["task", done ? "done" : "", fresh.has(r.task.id) ? "fresh" : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className="cb"
                  aria-label={done ? "برگرداندن" : "انجام شد"}
                  aria-pressed={done}
                  onClick={() => {
                    toggleTask(r);
                  }}
                >
                  <Icon name="tick" />
                </button>
                <span className="t">{r.task.title}</span>
                <span
                  className="ld"
                  style={{ background: lists.get(r.task.listId)?.color ?? "transparent" }}
                />
                <span className={r.late ? "m late" : "m"}>
                  {timeOf(r) || (r.late ? "عقب‌افتاده" : "")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="add"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() === "") return;
          addTask(draft);
          setDraft("");
        }}
      >
        <Icon name="plus" />
        <input
          value={draft}
          placeholder="کار جدید…"
          aria-label="کار جدید"
          onChange={(e) => {
            setDraft(e.target.value);
          }}
        />
      </form>
    </>
  );
}

export function NotesCard({
  signedIn,
  fresh,
  onSignIn,
}: {
  signedIn: boolean;
  fresh: ReadonlySet<string>;
  onSignIn: () => void;
}) {
  useRecordsVersion();
  const [draft, setDraft] = useState("");
  if (!signedIn) {
    return (
      <>
        <h3>یادداشت‌ها</h3>
        <SignInHint what="یادداشت‌هایت" onSignIn={onSignIn} />
      </>
    );
  }
  const notes = liveNotes();
  const [first, ...rest] = notes;
  const checks = first?.blocks.filter((b) => b.kind === "check").slice(0, 3) ?? [];
  return (
    <>
      <h3>یادداشت‌ها</h3>
      {first === undefined ? (
        <div className="empty">هنوز یادداشتی نیست.</div>
      ) : (
        <div className={fresh.has(first.id) ? "note fresh" : "note"}>
          <div className="nt-title">{noteTitle(first) || "یادداشت بی‌عنوان"}</div>
          {checks.length > 0 ? (
            <ul>
              {checks.map((b) => (
                <li key={b.id} className={b.done === true ? "ok" : ""}>
                  <i />
                  {b.text}
                </li>
              ))}
            </ul>
          ) : (
            noteSnippet(first) !== "" && <div className="meta">{noteSnippet(first)}</div>
          )}
        </div>
      )}
      {rest.length > 0 && (
        <div className="nlinks">
          {rest.slice(0, 2).map((n) => (
            <div key={n.id}>
              <span>{noteTitle(n) || "یادداشت بی‌عنوان"}</span>
              <small>{ago(n.updatedAt)}</small>
            </div>
          ))}
        </div>
      )}
      <form
        className="add"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() === "") return;
          addNote(draft, "");
          setDraft("");
        }}
      >
        <Icon name="edit" />
        <input
          value={draft}
          placeholder="یادداشت سریع…"
          aria-label="یادداشت سریع"
          onChange={(e) => {
            setDraft(e.target.value);
          }}
        />
      </form>
    </>
  );
}

export function TodayCard() {
  const now = useNow(30_000);
  const t = todayInfo(now);
  return (
    <>
      <div className="tday">
        <b>
          {t.weekday} {t.dayMonth}
        </b>
        <span>
          {t.gregorian} · {t.hijri}
        </span>
      </div>
      {t.occasions.length > 0 && (
        <div className="occ">
          {t.occasions.slice(0, 4).map((o) => (
            <span key={o.event.id} className={o.event.holiday ? "hol" : ""}>
              {o.event.title}
            </span>
          ))}
        </div>
      )}
      {t.next !== null && (
        <div className="nextp">
          <span>
            {t.next.name} · {t.place}
          </span>
          <b>{t.next.time}</b>
        </div>
      )}
    </>
  );
}
