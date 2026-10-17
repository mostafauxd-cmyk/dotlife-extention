import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useRecordsVersion } from "../hooks";
import {
  addNote,
  addTask,
  defaultList,
  liveLists,
  liveNotes,
  liveTasks,
  noteTitle,
  today,
} from "../noghte/model";
import { AD_LABEL, useAd } from "../ads";
import { search, suggest } from "../platform";
import { addDays } from "@dotlife/tasks";
import { ago } from "../ui/fa";
import { GMark, Icon } from "../ui/Icon";
import { openNote } from "./openNote";
import { openEditor } from "./TaskEditor";

/**
 * The big box: Google by default. «به کارها» and «به یادداشت‌ها» turn it into a quick task or note —
 * picked before or after typing — with a panel under it for the list, when (tasks) or a
 * description (notes), and the two latest items. Enter sends; Esc goes back to search.
 */

type Mode = "google" | "task" | "note";
type When = "today" | "tomorrow" | "none";

const MODES: Record<Mode, { ph: string; hint: string; go: string }> = {
  google: {
    ph: "در گوگل جستجو کن یا آدرس بنویس…",
    hint: "Enter جستجو · Shift+Enter خط تازه",
    go: "جستجو در گوگل",
  },
  task: {
    ph: "کار تازه…",
    hint: "Enter افزودن به کارها · Esc برگشت به جستجو",
    go: "افزودن به کارها",
  },
  note: {
    ph: "عنوان یادداشت تازه…",
    hint: "Enter ذخیره · Tab توضیح · Esc برگشت",
    go: "ذخیره در یادداشت‌ها",
  },
};

const reduced = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One thin line from the bottom middle of the box, round both sides, meeting at the top: sharp at its head, faded at its tail. */
function traceBox(box: HTMLElement): void {
  if (reduced()) return;
  box.querySelector(".trace")?.remove();
  const NS = "http://www.w3.org/2000/svg";
  const w = box.offsetWidth + 3;
  const h = box.offsetHeight + 3;
  const e = 0.8;
  const R = 23.5 - e;
  const m = w / 2;
  const half = (dir: -1 | 1): string => {
    const x0 = dir < 0 ? e : w - e;
    const sx = dir < 0 ? 1 : 0;
    const cx = (x: number): number => (dir < 0 ? x : w - x);
    return `M${String(m)} ${String(h - e)}H${String(cx(e + R))}A${String(R)} ${String(R)} 0 0 ${String(sx)} ${String(x0)} ${String(h - e - R)}V${String(e + R)}A${String(R)} ${String(R)} 0 0 ${String(sx)} ${String(cx(e + R))} ${String(e)}H${String(m)}`;
  };
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "trace");
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("viewBox", `0 0 ${String(w)} ${String(h)}`);
  svg.setAttribute("aria-hidden", "true");
  // one line, drawn as K slices: the head is sharp and white, the tail fades into the tint
  const K = 18;
  const parts: { p: SVGPathElement; i: number }[] = [];
  for (const dir of [-1, 1] as const) {
    for (let i = 0; i < K; i++) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", half(dir));
      p.setAttribute("class", "seg");
      p.style.stroke = `color-mix(in srgb, var(--tint) ${String(Math.round((i / K) * 100))}%, #fff)`;
      svg.append(p);
      parts.push({ p, i });
    }
  }
  box.append(svg);
  const L = parts[0]?.p.getTotalLength() ?? 0;
  const T = 1000;
  const ease = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  let t0: number | null = null;
  const step = (now: number): void => {
    t0 ??= now;
    const k = (now - t0) / T;
    const head = ease(k / 0.75) * L;
    const fade = k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
    const slice = (0.28 * L * (k < 0.75 ? 1 : 1 + (k - 0.75) * 3)) / K;
    for (const { p, i } of parts) {
      const to = Math.max(0, head - i * slice);
      const from = Math.max(0, head - (i + 1) * slice);
      p.style.strokeDasharray = `${String(Math.max(0.01, to - from))} ${String(L * 3)}`;
      p.style.strokeDashoffset = String(-from);
      p.style.opacity = String(fade * Math.pow(1 - i / K, 1.6));
    }
    if (k < 1) requestAnimationFrame(step);
    else svg.remove();
  };
  requestAnimationFrame(step);
}

export function SearchBox({
  traceAfter,
  onSaved,
}: {
  traceAfter: number | null;
  onSaved: (kind: "task" | "note") => void;
}) {
  useRecordsVersion();
  const [mode, setMode] = useState<Mode>("google");
  const [text, setText] = useState("");
  const [desc, setDesc] = useState("");
  const [listId, setListId] = useState<string | null>(null);
  const [when, setWhen] = useState<When>("today");
  const [swap, setSwap] = useState(0);
  // Google's suggestions while searching; `pick` is the row the arrow keys are on (-1: the typed text)
  const [sugg, setSugg] = useState<string[]>([]);
  const [pickAt, setPickAt] = useState(-1);
  const [focused, setFocused] = useState(true);
  const box = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setPickAt(-1);
    if (mode !== "google" || text.trim() === "") {
      setSugg([]);
      return;
    }
    let live = true;
    // a short pause, so a fast typist does not ask for every letter
    const t = setTimeout(() => {
      void suggest(text).then((list) => {
        if (live) setSugg(list.filter((x) => x !== text.trim()).slice(0, 6));
      });
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [text, mode]);
  const showSugg = mode === "google" && focused && sugg.length > 0 && text.trim() !== "";
  // slot 4: one row among the suggestions, aimed only by the word being typed
  const sponsored = useAd(4, { keyword: text });

  // the box grows with long text (Google takes up to 2,048 characters)
  useLayoutEffect(() => {
    const el = input.current;
    if (el === null) return;
    el.style.height = "auto";
    el.style.height = `${String(Math.min(el.scrollHeight, 150))}px`;
  }, [text]);

  // typing goes straight into the box when the tab opens (public/focus.js brings the keyboard here)
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (traceAfter === null) return;
    const t = setTimeout(() => {
      if (box.current !== null) traceBox(box.current);
    }, traceAfter);
    return () => {
      clearTimeout(t);
    };
  }, [traceAfter]);

  const lists = liveLists();
  const chosenList = lists.find((l) => l.id === listId) ?? defaultList(lists);

  const pick = (m: Mode): void => {
    const next = mode === m ? "google" : m;
    setMode(next);
    setSwap((x) => x + 1);
    input.current?.focus();
  };

  const submit = (): void => {
    const v = text.trim();
    if (v === "") {
      input.current?.focus();
      return;
    }
    if (mode === "google") {
      search(v);
      return;
    }
    if (mode === "task") {
      const day = when === "today" ? today() : when === "tomorrow" ? addDays(today(), 1) : null;
      addTask(v.split("\n")[0] ?? v, {
        ...(chosenList !== undefined ? { listId: chosenList.id } : {}),
        day,
      });
    } else {
      const [title = "", ...rest] = v.split("\n");
      const body = [rest.join("\n"), desc].filter((s) => s.trim() !== "").join("\n");
      addNote(title, body, chosenList?.id);
      setDesc("");
    }
    setText("");
    onSaved(mode);
    input.current?.focus();
  };

  const listName = (id: string | null | undefined): string => {
    const n = lists.find((l) => l.id === id)?.name;
    return n === undefined ? "" : ` · ${n}`;
  };
  const M = MODES[mode];
  const recentNotes = mode === "note" ? liveNotes().slice(0, 2) : [];
  const recentTasks =
    mode === "task"
      ? liveTasks()
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .slice(0, 2)
      : [];

  return (
    <div className="search2">
      <i className="sglow" aria-hidden="true" />
      <form
        ref={box}
        className="sbox"
        data-mode={mode}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="srow">
          <span
            key={swap}
            className={swap > 0 ? "gmark swap" : "gmark"}
            title={mode === "google" ? "جستجو در گوگل" : M.go}
          >
            {mode === "google" ? (
              <GMark />
            ) : (
              <Icon name={mode === "task" ? "tick-square" : "sticker-note"} />
            )}
          </span>
          <textarea
            ref={input}
            rows={1}
            value={text}
            placeholder={M.ph}
            aria-label={mode === "google" ? "جستجو در گوگل" : M.ph}
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value);
            }}
            onFocus={() => {
              setFocused(true);
            }}
            onBlur={() => {
              setFocused(false);
            }}
            onKeyDown={(e) => {
              if (showSugg && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                const n = sugg.length;
                setPickAt((i) =>
                  e.key === "ArrowDown" ? ((i + 2) % (n + 1)) - 1 : ((i + n + 1) % (n + 1)) - 1,
                );
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const chosen = showSugg ? sugg[pickAt] : undefined;
                if (chosen !== undefined) search(chosen);
                else submit();
              } else if (e.key === "Escape" && showSugg) {
                e.preventDefault();
                setSugg([]);
              } else if (e.key === "Escape" && mode !== "google") {
                e.preventDefault();
                setMode("google");
                setSwap((x) => x + 1);
              } else if (e.key === "Tab" && !e.shiftKey && mode === "note") {
                e.preventDefault();
                descRef.current?.focus();
              }
            }}
          />
        </div>
        <div className="srow2">
          <button
            type="button"
            className="act"
            aria-pressed={mode === "task"}
            title="نوشتن کار تازه به‌جای جستجو"
            onClick={() => {
              pick("task");
            }}
          >
            <Icon name="tick-square" />
            به کارها
          </button>
          <button
            type="button"
            className="act"
            aria-pressed={mode === "note"}
            title="نوشتن یادداشت تازه به‌جای جستجو"
            onClick={() => {
              pick("note");
            }}
          >
            <Icon name="sticker-note" />
            به یادداشت‌ها
          </button>
          <span className="grow" />
          <span className="hintk">{M.hint}</span>
          <button
            type="submit"
            className={text.trim() !== "" ? "ibtn go ready" : "ibtn go"}
            aria-label={M.go}
          >
            <Icon name="arrow-up" />
          </button>
        </div>
      </form>

      {showSugg && (
        <ul
          className="sugg-list"
          role="listbox"
          aria-label="پیشنهادهای گوگل"
          onMouseDown={(e) => {
            // a click keeps the caret in the box until the search goes
            e.preventDefault();
          }}
        >
          {sugg.map((q, i) => {
            const typed = text.trim();
            const rest = q.startsWith(typed) ? q.slice(typed.length) : null;
            return (
              <li
                key={q}
                role="option"
                aria-selected={i === pickAt}
                onMouseEnter={() => {
                  setPickAt(i);
                }}
                onClick={() => {
                  search(q);
                }}
              >
                <Icon name="search" />
                {rest === null ? (
                  <span>{q}</span>
                ) : (
                  <span>
                    {typed}
                    <b>{rest}</b>
                  </span>
                )}
              </li>
            );
          })}
          {sponsored !== null && (
            <li
              role="option"
              aria-selected={false}
              className="spons"
              onClick={() => {
                location.href = sponsored.url;
              }}
            >
              <Icon name="search" />
              <span>
                {sponsored.title}
                {sponsored.line !== undefined && ` · ${sponsored.line}`}
              </span>
              <span className="tag">{AD_LABEL}</span>
            </li>
          )}
        </ul>
      )}

      {mode !== "google" && (
        <div
          className="qpanel"
          onMouseDown={(e) => {
            // a chip keeps the caret in the box
            if ((e.target as HTMLElement).closest("button") !== null) e.preventDefault();
          }}
        >
          {mode === "note" ? (
            <div className="ts-line top qp-desc">
              <Icon name="edit" />
              <textarea
                ref={descRef}
                className="ts-notes"
                rows={3}
                value={desc}
                placeholder="توضیح… (اختیاری؛ عنوان همان متن بالاست)"
                aria-label="توضیح یادداشت"
                onChange={(e) => {
                  setDesc(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    submit();
                  } else if (e.key === "Escape") {
                    setMode("google");
                    input.current?.focus();
                  }
                }}
              />
            </div>
          ) : (
            <div className="qp-sec">
              <span className="qp-k">کی؟</span>
              <div className="ts-seg morph" role="radiogroup" aria-label="زمان">
                {(
                  [
                    ["today", "امروز"],
                    ["tomorrow", "فردا"],
                    ["none", "بدون تاریخ"],
                  ] as const
                ).map(([k, n]) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={when === k}
                    onClick={() => {
                      setWhen(k);
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {lists.length > 0 && (
            <div className="qp-sec">
              <span className="qp-k">در</span>
              <div className="ts-chips">
                {lists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={l.id === chosenList?.id}
                    onClick={() => {
                      setListId(l.id);
                    }}
                  >
                    <i style={{ background: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="ts-div" />
          <div className="qp-h">{mode === "note" ? "یادداشت‌های اخیر" : "کارهای اخیر"}</div>
          {mode === "note"
            ? recentNotes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="qrow"
                  onClick={() => {
                    openNote(n.id);
                  }}
                >
                  <span className="qi">
                    <Icon name="sticker-note" />
                  </span>
                  <span className="qt">
                    <b>{noteTitle(n) || "یادداشت بی‌عنوان"}</b>
                    <small>
                      {ago(n.updatedAt)}
                      {listName(n.folderId)}
                    </small>
                  </span>
                </button>
              ))
            : recentTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="qrow"
                  onClick={() => {
                    openEditor({ mode: "edit", task: t, occurrence: null });
                  }}
                >
                  <span className="qi">
                    <Icon name="tick-square" />
                  </span>
                  <span className="qt">
                    <b>{t.title}</b>
                    <small>
                      {ago(t.createdAt)}
                      {listName(t.listId)}
                    </small>
                  </span>
                </button>
              ))}
          {(mode === "note" ? recentNotes : recentTasks).length === 0 && (
            <p className="qp-none">
              {mode === "note" ? "هنوز یادداشتی نیست." : "هنوز کاری نیست."} همین‌که ذخیره کنی،
              این‌جا پیدایش می‌شود.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
