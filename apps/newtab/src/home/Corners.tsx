import { useEffect, useState, type ReactNode } from "react";

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
import { getLink, installId } from "../install";
import { todayInfo } from "../today";
import { ago, fa } from "../ui/fa";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/icons";
import { Qr } from "../ui/Qr";

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

/** One word beside the title; the full sentence is its tooltip. */
function SyncBadge() {
  const s = useSyncState();
  const [word, full] =
    s.status === "syncing"
      ? ["همگام‌سازی…", "در حال همگام‌سازی با گوشی"]
      : s.status === "offline"
        ? ["آفلاین", "آفلاین؛ وقتی وصل شدی می‌فرستم"]
        : s.status === "error"
          ? ["ناهمگام", "همگام نشد؛ دوباره امتحان می‌کنم"]
          : s.status === "signed-out"
            ? [
                "روی این مرورگر",
                "فقط روی همین مرورگر نگه داشته می‌شود؛ با ورود به نقطه روی گوشی هم می‌آید",
              ]
            : ["همگام", "همگام با گوشی"];
  return (
    <span className={`sync ${s.status}`} title={full}>
      <i />
      {word}
    </span>
  );
}

/** Signed out: one line that says what you get, one that says how, the button; the app's code beside. */
function SignInHint({
  head,
  place,
  onSignIn,
}: {
  head: string;
  place: string;
  onSignIn: () => void;
}) {
  const [install, setInstall] = useState<string | null>(null);
  useEffect(() => {
    void installId().then(setInstall);
  }, []);
  return (
    <div className="signin-cta">
      <div className="sc-text">
        <b>{head}</b>
        <p>وارد شو تا این‌جا و گوشی یکی شوند. نقطه را نداری؟ کد را با گوشی اسکن کن.</p>
        <button type="button" className="cta" onClick={onSignIn}>
          ورود به نقطه
        </button>
      </div>
      {install !== null && (
        <Qr text={getLink("noghte", place, install)} label="کد نصب نقطه از کافه‌بازار" />
      )}
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
  const lists = new Map(liveLists().map((l) => [l.id, l]));
  const all = liveTasks();
  const rows = todayRows(all);
  return (
    <>
      <h3>
        کارهای امروز <SyncBadge />
      </h3>
      {rows.length === 0 && !signedIn && all.length === 0 ? (
        <SignInHint head="کارهای گوشی‌ات، همین‌جا" place="tasks" onSignIn={onSignIn} />
      ) : rows.length === 0 ? (
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
      {!signedIn && all.length > 0 && <SyncInvite place="tasks" onSignIn={onSignIn} />}
    </>
  );
}

/**
 * Signed out, with things written here: a small box that says they live in this browser only and
 * offers to keep them on the phone too — two short lines, the sign-in button, and the app's code.
 */
export function SyncInvite({ place, onSignIn }: { place: string; onSignIn: () => void }) {
  const [install, setInstall] = useState<string | null>(null);
  useEffect(() => {
    void installId().then(setInstall);
  }, []);
  return (
    <div className="sync-invite">
      <div className="si-text">
        <b>فقط روی همین مرورگر است</b>
        <span>وارد شو تا روی گوشی هم بیاید.</span>
        <button type="button" className="cta" onClick={onSignIn}>
          ورود به نقطه
        </button>
      </div>
      {install !== null && (
        <Qr text={getLink("noghte", place, install)} label="کد نصب نقطه از کافه‌بازار" />
      )}
    </div>
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
  const notes = liveNotes().slice(0, 2);
  const save = (): void => {
    const v = draft.trim();
    if (v === "") return;
    const [title = "", ...body] = v.split("\n");
    addNote(title, body.join("\n"));
    setDraft("");
  };
  return (
    <>
      <h3>یادداشت‌ها</h3>
      <form
        className="qnote"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <textarea
          rows={4}
          value={draft}
          placeholder="یادداشت سریع بنویس… خط اول، عنوانش می‌شود."
          aria-label="یادداشت سریع"
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
        />
        <div className="qn-f">
          <span>{signedIn ? "روی گوشی هم دیده می‌شود" : "روی همین مرورگر نگه داشته می‌شود"}</span>
          <button
            type="submit"
            className="qn-go"
            disabled={draft.trim() === ""}
            aria-label="ذخیره‌ی یادداشت"
          >
            <Icon name="arrow-up" />
          </button>
        </div>
      </form>
      {notes.length === 0 && !signedIn ? (
        <SignInHint head="یادداشت‌های گوشی‌ات، همین‌جا" place="notes" onSignIn={onSignIn} />
      ) : notes.length === 0 ? (
        <div className="empty">هنوز یادداشتی نیست.</div>
      ) : (
        <div className="rlist" aria-label="یادداشت‌های اخیر">
          {notes.map((n) => (
            <div key={n.id} className={fresh.has(n.id) ? "rnote fresh" : "rnote"}>
              <b>{noteTitle(n) || "یادداشت بی‌عنوان"}</b>
              <small>
                {ago(n.updatedAt)}
                {noteSnippet(n) !== "" && ` · ${noteSnippet(n)}`}
              </small>
            </div>
          ))}
        </div>
      )}
      {!signedIn && notes.length > 0 && <SyncInvite place="notes" onSignIn={onSignIn} />}
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
