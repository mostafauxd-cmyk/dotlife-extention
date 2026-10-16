import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { localNow } from "@dotlife/tasks";

import { useRecordsVersion, useSyncState } from "../hooks";
import {
  addFolder,
  allNotes,
  liveLists,
  liveTasks,
  newId,
  newNote,
  saveNote,
  TIME_ZONE,
  today,
  trashNote,
  type Note,
} from "../noghte/model";
import {
  checklistProgress,
  clock,
  groupNotes,
  joinBackward,
  notePreview,
  noteTitle,
  resample,
  rowDate,
  searchNotes,
  setKind,
  setText,
  solarDay,
  splitBlock,
  toggleDone,
  type Block,
  type Caret,
  type NoteSection,
} from "../noghte/notes";
import { ago, fa } from "../ui/fa";
import { Icon } from "../ui/Icon";
import { SyncInvite } from "./Corners";
import { onOpenNote } from "./openNote";

/**
 * The notes slide, as the app's notes: folders (which are task lists), the list with its pinned
 * notes, search and the app's date groups, and a full editor — title, text, headings, bullets and
 * checklists. Editing uses the app's own rules (`noghte/notes.ts`), and every change is a whole
 * record synced a moment later. Voice notes play on the phone; here they show their wave and words.
 */

/** «all», «trash», or a list's id. */
type Folder = string;

/** The colours a new folder takes in turn (the app's list colours). */
const COLORS = ["#8C9EFF", "#5AB0FF", "#F2A65A", "#8ADD88", "#E59AAA", "#B79CF0", "#F2C94C"];

const dayOf = (iso: string) => localNow(TIME_ZONE, new Date(iso)).date;

export function NotesSlide({ signedIn, onSignIn }: { signedIn: boolean; onSignIn: () => void }) {
  useRecordsVersion();
  const [folder, setFolder] = useState<Folder>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const focusTitle = useRef(false);
  // a note picked elsewhere on the page (the search box's recent notes)
  useEffect(
    () =>
      onOpenNote((id) => {
        setFolder("all");
        setQuery("");
        setOpenId(id);
      }),
    [],
  );

  const lists = liveLists();
  const notes = allNotes();
  const live = notes.filter((n) => n.deletedAt === undefined);
  const trash = notes.filter((n) => n.deletedAt !== undefined);
  const pool =
    folder === "all"
      ? live
      : folder === "trash"
        ? trash
        : live.filter((n) => n.folderId === folder);
  const searching = query.trim() !== "";
  const sections: NoteSection[] = searching
    ? [{ key: "found", title: "نتیجه‌ها", notes: searchNotes(pool, query) }]
    : groupNotes(pool, today(), dayOf);
  const shown = sections.flatMap((s) => s.notes);
  const open = notes.find((n) => n.id === openId) ?? shown[0];

  const create = (): void => {
    const n = newNote(folder === "all" || folder === "trash" ? undefined : folder);
    if (folder === "trash") setFolder("all");
    setQuery("");
    focusTitle.current = true;
    setOpenId(n.id);
  };

  return (
    <div className="s-pad notes-s">
      <aside className="card g folders">
        <div className="card-h">
          <h2>یادداشت‌ها</h2>
        </div>
        <div className="flist">
          <FolderRow
            on={folder === "all"}
            icon={<Icon name="sticker-note" />}
            name="همه‌ی یادداشت‌ها"
            count={live.length}
            onPick={() => {
              setFolder("all");
            }}
          />
          {lists.map((l) => (
            <FolderRow
              key={l.id}
              on={folder === l.id}
              icon={<span className="fdot" style={{ background: l.color }} />}
              name={l.name}
              count={live.filter((n) => n.folderId === l.id).length}
              onPick={() => {
                setFolder(l.id);
              }}
            />
          ))}
          <span className="fsep" />
          <FolderRow
            on={folder === "trash"}
            icon={<Icon name="delete" />}
            name="حذف‌شده‌ها"
            count={trash.length}
            onPick={() => {
              setFolder("trash");
            }}
          />
        </div>
        {naming ? (
          <input
            className="newf-in"
            autoFocus
            placeholder="اسم دسته…"
            onKeyDown={(e) => {
              const v = e.currentTarget.value.trim();
              if (e.key === "Enter" && v !== "") {
                const l = addFolder(v, COLORS[lists.length % COLORS.length] ?? "#8C9EFF");
                setNaming(false);
                setFolder(l.id);
              } else if (e.key === "Escape") setNaming(false);
            }}
            onBlur={() => {
              setNaming(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="newf"
            onClick={() => {
              setNaming(true);
            }}
          >
            <Icon name="plus" />
            دسته‌ی تازه
          </button>
        )}
      </aside>

      <div className="card g nlist">
        <label className="nsearch">
          <Icon name="search" />
          <input
            value={query}
            placeholder="جستجو در یادداشت‌ها…"
            autoComplete="off"
            aria-label="جستجو در یادداشت‌ها"
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </label>
        <div className="nitems">
          {shown.length === 0 ? (
            <p className="none">
              {searching
                ? "یادداشتی با این کلمه نیست."
                : folder === "trash"
                  ? "حذف‌شده‌ها خالی است."
                  : "هنوز یادداشتی این‌جا نیست."}
            </p>
          ) : (
            sections.map((s) => (
              <div key={s.key} className="ngroup">
                <div className="glbl">{s.title}</div>
                {s.notes.map((n) => (
                  <NoteRow
                    key={n.id}
                    note={n}
                    on={open?.id === n.id}
                    onPick={() => {
                      setOpenId(n.id);
                    }}
                  />
                ))}
              </div>
            ))
          )}
        </div>
        {!signedIn && <SyncInvite place="notes-slide" onSignIn={onSignIn} />}
        <button type="button" className="cta newn" onClick={create}>
          <Icon name="edit" />
          یادداشت تازه
        </button>
      </div>

      <article className="card g editor">
        {open !== undefined ? (
          <Editor key={open.id} note={open} focusTitle={focusTitle} />
        ) : (
          <div className="ed-empty">
            <Icon name="sticker-note" />
            <p>یادداشتی را باز کن یا یکی تازه بنویس.</p>
          </div>
        )}
      </article>
    </div>
  );
}

function FolderRow({
  on,
  icon,
  name,
  count,
  onPick,
}: {
  on: boolean;
  icon: React.ReactNode;
  name: string;
  count: number;
  onPick: () => void;
}) {
  return (
    <button type="button" aria-pressed={on} onClick={onPick}>
      {icon}
      <span className="fname">{name}</span>
      <span className="fcount">{fa(count)}</span>
    </button>
  );
}

function NoteRow({ note, on, onPick }: { note: Note; on: boolean; onPick: () => void }) {
  const progress = checklistProgress(note);
  const preview = notePreview(note);
  return (
    <button type="button" className={on ? "nitem on" : "nitem"} onClick={onPick}>
      <b>{noteTitle(note)}</b>
      <span className="mt">
        {fa(rowDate(localNow(TIME_ZONE, new Date(note.updatedAt)), today()))}
        {progress !== null && (
          <span className="prog">
            <Icon name="tick-square" />
            {fa(`${String(progress.done)}/${String(progress.total)}`)}
          </span>
        )}
        {preview !== "" && <em>{preview}</em>}
      </span>
    </button>
  );
}

/** One note, open: each block a text box that grows with its words. */
function Editor({ note, focusTitle }: { note: Note; focusTitle: React.RefObject<boolean> }) {
  const sync = useSyncState();
  const boxes = useRef(new Map<string, HTMLTextAreaElement>());
  const caret = useRef<Caret | null>(null);
  const [focused, setFocused] = useState(0);
  const lists = liveLists();
  const folder = lists.find((l) => l.id === note.folderId);
  const task =
    note.taskId === undefined ? undefined : liveTasks().find((t) => t.id === note.taskId);
  const trashed = note.deletedAt !== undefined;

  // after Enter, Backspace or a new kind, the caret goes where the app's rules say
  useLayoutEffect(() => {
    const c = caret.current;
    if (focusTitle.current) {
      focusTitle.current = false;
      boxes.current.get(note.blocks[0]?.id ?? "")?.focus();
    }
    if (c === null) return;
    caret.current = null;
    const el = boxes.current.get(c.id);
    if (el === undefined) return;
    el.focus();
    el.setSelectionRange(c.at, c.at);
  });

  const write = (blocks: Block[], next?: Caret): void => {
    if (next !== undefined) caret.current = next;
    saveNote({ ...note, blocks });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>, i: number): void => {
    const el = e.currentTarget;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const r = splitBlock(note.blocks, i, el.selectionStart, newId);
      write(r.blocks, r.caret);
    } else if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      const r = joinBackward(note.blocks, i);
      if (r === null) return;
      e.preventDefault();
      write(r.blocks, r.caret);
    }
  };

  const box = (b: Block, i: number, cls: string, placeholder?: string) => (
    <textarea
      ref={(el) => {
        if (el === null) boxes.current.delete(b.id);
        else boxes.current.set(b.id, el);
      }}
      className={cls}
      rows={1}
      value={b.text}
      placeholder={placeholder}
      readOnly={trashed}
      onFocus={() => {
        setFocused(i);
      }}
      onChange={(e) => {
        write(setText(note.blocks, b.id, e.target.value));
      }}
      onKeyDown={(e) => {
        onKey(e, i);
      }}
    />
  );

  return (
    <>
      <div className="ed-top">
        <span className={`st ${sync.status}`}>
          <i />
          {sync.status === "signed-out"
            ? "روی همین مرورگر"
            : sync.status === "offline"
              ? "آفلاین"
              : "همگام"}{" "}
          · {ago(note.updatedAt)}
        </span>
        <span className="tools">
          {!trashed && (
            <>
              <button
                type="button"
                className="rbtn sm"
                aria-label="چک‌لیست"
                title="چک‌لیست"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  const r = setKind(note.blocks, focused, "check", newId);
                  write(r.blocks, r.caret);
                }}
              >
                <Icon name="tick-square" />
              </button>
              <button
                type="button"
                className="rbtn sm"
                aria-label={note.pinned ? "برداشتن سنجاق" : "سنجاق"}
                aria-pressed={note.pinned}
                title={note.pinned ? "برداشتن سنجاق" : "سنجاق"}
                onClick={() => {
                  saveNote({ ...note, pinned: !note.pinned });
                }}
              >
                <Icon name="pin" />
              </button>
            </>
          )}
          <button
            type="button"
            className="rbtn sm"
            aria-label={trashed ? "برگرداندن" : "حذف"}
            title={trashed ? "برگرداندن" : "حذف"}
            onClick={() => {
              trashNote(note, !trashed);
            }}
          >
            <Icon name={trashed ? "refresh" : "delete"} />
          </button>
        </span>
      </div>

      <div className="ed-links">
        {folder !== undefined && (
          <span style={{ background: `${folder.color}29`, color: folder.color }}>
            <span className="fdot" style={{ background: folder.color }} />
            {folder.name}
          </span>
        )}
        {note.day !== undefined && (
          <span>
            <Icon name="calendar-face" />
            {fa(solarDay(note.day))}
          </span>
        )}
        {task !== undefined && (
          <span>
            <Icon name="tick-square" />
            کار: {task.title}
          </span>
        )}
      </div>

      <div className="ed-body">
        {note.blocks.map((b, i) => {
          if (b.kind === "title") return <div key={b.id}>{box(b, i, "ed-title", "عنوان")}</div>;
          if (b.kind === "heading") return <div key={b.id}>{box(b, i, "b-h")}</div>;
          if (b.kind === "bullet")
            return (
              <div key={b.id} className="b-b">
                <i />
                {box(b, i, "tx")}
              </div>
            );
          if (b.kind === "check")
            return (
              <div key={b.id} className={b.done === true ? "b-c done" : "b-c"}>
                <button
                  type="button"
                  aria-label={b.done === true ? "انجام نشده" : "انجام شد"}
                  aria-pressed={b.done === true}
                  disabled={trashed}
                  onClick={() => {
                    write(toggleDone(note.blocks, b.id));
                  }}
                >
                  <Icon name="tick" />
                </button>
                {box(b, i, "tx")}
              </div>
            );
          if (b.kind === "voice" && b.voice !== undefined)
            return <VoiceBlock key={b.id} voice={b.voice} />;
          return (
            <div key={b.id}>
              {box(b, i, "b-p", i === 1 && note.blocks.length === 2 ? "بنویس…" : undefined)}
            </div>
          );
        })}
      </div>
    </>
  );
}

/** A recording made on the phone: its wave and length, and its words when they have been written out. */
function VoiceBlock({ voice }: { voice: NonNullable<Block["voice"]> }) {
  const bars = resample(voice.peaks, 48);
  const words = voice.transcript?.status === "done" ? (voice.transcript.text ?? "") : "";
  return (
    <div className="b-v">
      <div className="row">
        <span className="play" title="پخش روی گوشی">
          <Icon name="voice-play" />
        </span>
        <svg className="wave" viewBox={`0 0 ${String(bars.length * 6)} 32`} aria-hidden="true">
          {bars.map((v, i) => {
            const h = Math.max(3, v * 30);
            return <rect key={i} x={i * 6} y={(32 - h) / 2} width="3" height={h} rx="1.5" />;
          })}
        </svg>
        <span className="time">{fa(clock(voice.durationMs))}</span>
      </div>
      <div className="tr">{words !== "" ? words : "یادداشت صوتی؛ روی گوشی پخش می‌شود."}</div>
    </div>
  );
}
