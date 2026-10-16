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
import { search } from "../platform";
import { addDays } from "@dotlife/tasks";
import { ago } from "../ui/fa";
import { GMark, Icon } from "../ui/Icon";

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

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
const Speech = ((window as unknown as Record<string, unknown>).SpeechRecognition ??
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as SpeechCtor | undefined;

const reduced = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One thin line from the bottom middle of the box, round both sides, meeting at the top: sharp at its head, faded at its tail. */
function traceBox(box: HTMLElement): void {
  if (reduced()) return;
  box.querySelector(".trace")?.remove();
  const NS = "http://www.w3.org/2000/svg";
  const w = box.offsetWidth + 3;
  const h = box.offsetHeight + 3;
  const e = 0.8;
  const R = 27.5 - e;
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
  const T = 1500;
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
  signedIn,
  traceAfter,
  onNeedSignIn,
  onSaved,
}: {
  signedIn: boolean;
  traceAfter: number | null;
  onNeedSignIn: () => void;
  onSaved: (kind: "task" | "note") => void;
}) {
  useRecordsVersion();
  const [mode, setMode] = useState<Mode>("google");
  const [text, setText] = useState("");
  const [desc, setDesc] = useState("");
  const [listId, setListId] = useState<string | null>(null);
  const [when, setWhen] = useState<When>("today");
  const [listening, setListening] = useState(false);
  const [swap, setSwap] = useState(0);
  const box = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // the box grows with long text (Google takes up to 2,048 characters)
  useLayoutEffect(() => {
    const el = input.current;
    if (el === null) return;
    el.style.height = "auto";
    el.style.height = `${String(Math.min(el.scrollHeight, 150))}px`;
  }, [text]);

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
    if (next !== "google" && !signedIn) {
      onNeedSignIn();
      return;
    }
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

  const listen = (): void => {
    if (Speech === undefined) return;
    const r = new Speech();
    r.lang = "fa-IR";
    r.interimResults = true;
    r.onresult = (e) => {
      setText(
        Array.from(e.results)
          .map((x) => x[0]?.transcript ?? "")
          .join(""),
      );
    };
    r.onend = () => {
      setListening(false);
      input.current?.focus();
    };
    r.onerror = () => {
      setListening(false);
    };
    setListening(true);
    r.start();
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
            placeholder={listening ? "گوش می‌دهم… بگو چه می‌خواهی" : M.ph}
            aria-label={mode === "google" ? "جستجو در گوگل" : M.ph}
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
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
          {Speech !== undefined && (
            <button
              type="button"
              className={listening ? "ibtn mic on" : "ibtn mic"}
              aria-label="جستجوی صوتی"
              aria-pressed={listening}
              onClick={listen}
            >
              <Icon name="voice" />
            </button>
          )}
          <button
            type="submit"
            className={text.trim() !== "" ? "ibtn go ready" : "ibtn go"}
            aria-label={M.go}
          >
            <Icon name="arrow-up" />
          </button>
        </div>
      </form>

      {mode !== "google" && (
        <div
          className="qpanel"
          onMouseDown={(e) => {
            // a chip keeps the caret in the box
            if ((e.target as HTMLElement).closest("button") !== null) e.preventDefault();
          }}
        >
          {mode === "note" ? (
            <textarea
              ref={descRef}
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
          ) : (
            <div className="chips">
              <span>کی؟</span>
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
                  aria-pressed={when === k}
                  onClick={() => {
                    setWhen(k);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {lists.length > 0 && (
            <div className="chips">
              <span>در</span>
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
          )}
          <div className="dhd">{mode === "note" ? "یادداشت‌های اخیر" : "کارهای اخیر"}</div>
          {mode === "note"
            ? recentNotes.map((n) => (
                <div key={n.id} className="qrow">
                  <Icon name="sticker-note" />
                  <span>
                    <b>{noteTitle(n) || "یادداشت بی‌عنوان"}</b>
                    <small>
                      {ago(n.updatedAt)} · {lists.find((l) => l.id === n.folderId)?.name ?? ""}
                    </small>
                  </span>
                </div>
              ))
            : recentTasks.map((t) => (
                <div key={t.id} className="qrow">
                  <Icon name="tick-square" />
                  <span>
                    <b>{t.title}</b>
                    <small>
                      {ago(t.createdAt)} · {lists.find((l) => l.id === t.listId)?.name ?? ""}
                    </small>
                  </span>
                </div>
              ))}
          {(mode === "note" ? recentNotes : recentTasks).length === 0 && (
            <div className="dhd">هنوز چیزی نیست.</div>
          )}
        </div>
      )}
    </div>
  );
}
