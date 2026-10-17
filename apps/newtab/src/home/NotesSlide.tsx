import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { localNow } from "@dotlife/tasks";

import { useRecordsVersion, useSyncState } from "../hooks";
import {
  allNotes,
  liveLists,
  liveTasks,
  newId,
  newNote,
  saveNote,
  TIME_ZONE,
  addNote,
  today,
  trashNote,
  type Note,
} from "../noghte/model";
import {
  checklistProgress,
  clock,
  groupNotes,
  insertVoice,
  joinBackward,
  linkLabel,
  notePreview,
  noteTitle,
  resample,
  removeBlock,
  rowDate,
  searchNotes,
  setKind,
  setText,
  solarDay,
  splitBlock,
  toggleDone,
  urlsIn,
  withoutUrls,
  withUrlsKept,
  type Block,
  type BlockKind,
  type Caret,
  type NoteSection,
  type Voice,
} from "../noghte/notes";
import { dropVoice, voiceUrl } from "../noghte/voiceStore";
import { faviconUrl } from "../platform";
import { ago, fa } from "../ui/fa";
import { Icon } from "../ui/Icon";
import { SyncInvite } from "./Corners";
import { AD_LABEL, useAd } from "../ads";
import { openNewCategory } from "./NewCategory";
import { VoiceRecorder } from "./VoiceRecorder";
import { onOpenNote } from "./openNote";

/**
 * The notes slide, as the app's notes: folders (which are task lists), the list with its pinned
 * notes, search and the app's date groups, and a full editor — title, text, headings, bullets and
 * checklists. Editing uses the app's own rules (`noghte/notes.ts`), and every change is a whole
 * record synced a moment later. The editor follows the app's (`apps/mobile/app/note/[id].tsx`): the
 * format bar under the note (heading, text, list, checklist, the mic) and the recording panel that
 * takes its place. A web address in a line shows under it as a link. A recording made here plays
 * here (its audio stays in this browser); one made on the phone shows its wave and words.
 */

/** The app's formats, in its order, with its glyphs (a 22-unit box, 1.6 strokes). */
const FORMATS: readonly { kind: Exclude<BlockKind, "title" | "voice">; label: string }[] = [
  { kind: "heading", label: "سرتیتر" },
  { kind: "text", label: "متن" },
  { kind: "bullet", label: "فهرست" },
  { kind: "check", label: "چک‌لیست" },
];
const GLYPH: Record<"heading" | "text" | "bullet", string> = {
  heading: "M3 5.5 H12.5 M7.75 5.5 V17 M13.5 10.5 H19 M16.25 10.5 V17",
  text: "M3 5.5 H19 M3 10 H19 M3 14.5 H19 M9 19 H19",
  bullet: "M8 6 H19 M8 11.5 H19 M8 17 H19 M3.6 6 h0.01 M3.6 11.5 h0.01 M3.6 17 h0.01",
};

function FormatGlyph({ kind }: { kind: Exclude<BlockKind, "title" | "voice"> }) {
  if (kind === "check") return <Icon name="tick-square" />;
  return (
    <svg className="ico" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d={GLYPH[kind]}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** «all», «trash», or a list's id. */
type Folder = string;

/** The colours a new folder takes in turn (the app's list colours). */

const dayOf = (iso: string) => localNow(TIME_ZONE, new Date(iso)).date;

export function NotesSlide({ signedIn, onSignIn }: { signedIn: boolean; onSignIn: () => void }) {
  useRecordsVersion();
  const [folder, setFolder] = useState<Folder>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
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
        <TemplateCard
          onMade={(id) => {
            setFolder("all");
            setQuery("");
            setOpenId(id);
          }}
        />
        <button
          type="button"
          className="newf"
          onClick={() => {
            openNewCategory((l) => {
              setFolder(l.id);
            });
          }}
        >
          <Icon name="plus" />
          دسته‌ی تازه
        </button>
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
  const [recording, setRecording] = useState(false);
  // where the recording drops in: the line the caret was on when it started
  const recordAt = useRef(0);
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

  /** A finished recording goes into the note as it is now (a sync or another edit may have come since). */
  const addVoice = (voice: Voice): void => {
    const now = allNotes().find((n) => n.id === note.id) ?? note;
    const r = insertVoice(now.blocks, recordAt.current, voice, newId);
    saveNote({ ...now, blocks: r.blocks });
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

  const box = (b: Block, i: number, cls: string, placeholder?: string) => {
    const words = withoutUrls(b.text);
    return (
      <textarea
        ref={(el) => {
          if (el === null) boxes.current.delete(b.id);
          else boxes.current.set(b.id, el);
        }}
        className={words === "" && urlsIn(b.text).length > 0 ? `${cls} url-only` : cls}
        rows={1}
        value={words}
        placeholder={placeholder}
        readOnly={trashed}
        onFocus={() => {
          setFocused(i);
        }}
        onChange={(e) => {
          write(setText(note.blocks, b.id, withUrlsKept(b.text, e.target.value)));
        }}
        onKeyDown={(e) => {
          onKey(e, i);
        }}
      />
    );
  };

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
          if (b.kind === "voice" && b.voice !== undefined) {
            return (
              <VoiceBlock
                key={b.id}
                voice={b.voice}
                onRemove={
                  trashed
                    ? undefined
                    : () => {
                        write(removeBlock(note.blocks, b.id));
                        void dropVoice(b.voice?.file ?? "");
                      }
                }
              />
            );
          }
          let el: React.ReactNode;
          if (b.kind === "title") el = <div>{box(b, i, "ed-title", "عنوان")}</div>;
          else if (b.kind === "heading") el = <div>{box(b, i, "b-h")}</div>;
          else if (b.kind === "bullet")
            el = (
              <div className="b-b">
                <i />
                {box(b, i, "tx")}
              </div>
            );
          else if (b.kind === "check")
            el = (
              <div className={b.done === true ? "b-c done" : "b-c"}>
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
          else
            el = (
              <div>
                {box(b, i, "b-p", i === 1 && note.blocks.length === 2 ? "بنویس…" : undefined)}
              </div>
            );
          const links = urlsIn(b.text);
          return (
            <Fragment key={b.id}>
              {el}
              {links.length > 0 && (
                <div
                  className={b.kind === "bullet" || b.kind === "check" ? "b-links in" : "b-links"}
                >
                  {links.map((u) => (
                    <a
                      key={u}
                      className="b-link"
                      href={u}
                      target="_blank"
                      rel="noreferrer"
                      title={u}
                    >
                      <img src={faviconUrl(u, 32)} alt="" draggable={false} />
                      <span dir="ltr">{linkLabel(u)}</span>
                      <Icon name="arrow-up" />
                    </a>
                  ))}
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {!trashed &&
        (recording ? (
          <div className="ed-bar rec-on">
            <VoiceRecorder
              onDone={addVoice}
              onClose={() => {
                setRecording(false);
              }}
            />
          </div>
        ) : (
          <div className="ed-bar" role="toolbar" aria-label="قالب‌بندی">
            {FORMATS.map((f) => {
              const on = note.blocks[focused]?.kind === f.kind && focused > 0;
              return (
                <button
                  key={f.kind}
                  type="button"
                  className="fmt"
                  aria-label={f.label}
                  title={f.label}
                  aria-pressed={on}
                  onMouseDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    const r = setKind(note.blocks, focused, f.kind, newId);
                    write(r.blocks, r.caret);
                  }}
                >
                  <FormatGlyph kind={f.kind} />
                </button>
              );
            })}
            <button
              type="button"
              className="fmt"
              aria-label="ضبط صدا"
              title="ضبط صدا"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                recordAt.current = focused;
                setRecording(true);
              }}
            >
              <Icon name="voice" />
            </button>
          </div>
        ))}
    </>
  );
}

/**
 * A recording: its wave and length, and its words when they have been written out. One made in this
 * browser plays here (click the wave to move around); one made on the phone plays there.
 */
function VoiceBlock({ voice, onRemove }: { voice: Voice; onRemove: (() => void) | undefined }) {
  const bars = resample(voice.peaks, 48);
  const words = voice.transcript?.status === "done" ? (voice.transcript.text ?? "") : "";
  // undefined: looking; null: not in this browser
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    void voiceUrl(voice.file).then((u) => {
      made = u;
      if (live) setUrl(u);
      else if (u !== null) URL.revokeObjectURL(u);
    });
    return () => {
      live = false;
      if (made !== null) URL.revokeObjectURL(made);
    };
  }, [voice.file]);
  const toggle = (): void => {
    const a = audio.current;
    if (a === null) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  return (
    <div className="b-v">
      <div className="row">
        <button
          type="button"
          className="play"
          aria-label={playing ? "مکث" : "پخش"}
          title={url === null ? "روی دستگاهی که ضبط شد پخش می‌شود" : playing ? "مکث" : "پخش"}
          disabled={url === null || url === undefined}
          onClick={toggle}
        >
          <Icon name={playing ? "voice-pause" : "voice-play"} />
        </button>
        <svg
          className={url === null || url === undefined ? "wave" : "wave seek"}
          viewBox={`0 0 ${String(bars.length * 6)} 32`}
          aria-hidden="true"
          onClick={(e) => {
            const a = audio.current;
            if (a === null || !Number.isFinite(a.duration)) return;
            const box = e.currentTarget.getBoundingClientRect();
            // the wave reads right to left, like the page
            a.currentTime =
              a.duration * Math.min(1, Math.max(0, (box.right - e.clientX) / box.width));
          }}
        >
          {bars.map((v, i) => {
            const h = Math.max(3, v * 30);
            const x = (bars.length - 1 - i) * 6;
            return (
              <rect
                key={i}
                className={i / bars.length < pos ? "on" : undefined}
                x={x}
                y={(32 - h) / 2}
                width="3"
                height={h}
                rx="1.5"
              />
            );
          })}
        </svg>
        <span className="time">{fa(clock(voice.durationMs))}</span>
        {onRemove !== undefined && (
          <button
            type="button"
            className="rm"
            aria-label="حذف صدا"
            title="حذف صدا"
            onClick={onRemove}
          >
            <Icon name="close" />
          </button>
        )}
      </div>
      {url !== null && url !== undefined && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onPlay={() => {
            setPlaying(true);
          }}
          onPause={() => {
            setPlaying(false);
          }}
          onEnded={() => {
            setPlaying(false);
            setPos(0);
          }}
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            setPos(Number.isFinite(a.duration) && a.duration > 0 ? a.currentTime / a.duration : 0);
          }}
        />
      )}
      {(words !== "" || url === null) && (
        <div className="tr">
          {words !== "" ? words : "یادداشت صوتی؛ روی دستگاهی که ضبط شد پخش می‌شود."}
        </div>
      )}
    </div>
  );
}

/** Slot 13: a note template from a partner; «استفاده» makes a new note from it. */
function TemplateCard({ onMade }: { onMade: (id: string) => void }) {
  const ad = useAd(13);
  if (ad === null) return null;
  return (
    <div className="tpl">
      <span className="sec">قالب پیشنهادی</span>
      <b>{ad.title}</b>
      <span>
        {ad.line}
        <span className="tag">{AD_LABEL}</span>
      </span>
      <button
        type="button"
        className="chip"
        onClick={() => {
          onMade(addNote(ad.title, ad.extra?.body ?? "").id);
        }}
      >
        {ad.cta ?? "استفاده از قالب"}
      </button>
    </div>
  );
}
