import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { daysInMonth, fromJdn, monthName, toJdn, WEEKDAY_NAMES_FA } from "@dotlife/calendar-core";
import {
  addDays,
  dateToJdn,
  expandOccurrences,
  jdnToDate,
  localNow,
  minutesToTime,
  overdue,
  tasksOnDay,
  timeToMinutes,
  unscheduled,
  type LocalDate,
  type Occurrence,
  type Task,
  type TaskList,
} from "@dotlife/tasks";

import { useNow, useRecordsVersion, useSettings } from "../hooks";
import {
  addTask,
  addTimedTask,
  liveLists,
  liveNotes,
  liveTasks,
  TIME_ZONE,
  today,
  toggleTask,
} from "../noghte/model";
import { noteTitle, normalize, searchNotes } from "../noghte/notes";
import { updateSettings } from "../settings";
import { occasionsOn } from "../today";
import { fa } from "../ui/fa";
import { Icon } from "../ui/Icon";

/**
 * The plans slide, as the app's «برنامه‌ها». Two tabs:
 * - «تقویم»: a week (or three days, or one) in Google Calendar's manner. Each day a column of hours
 *   with the day's timed tasks and «now» as a white line; above them a row for the whole day — occasions and tasks with no time. Dragging over the
 *   hours opens «برنامه‌ی تازه», which asks for the title and the list, as the app does.
 * - «کارها»: the account's open tasks, late, today, coming up and with no date, per list or all.
 * Beside both a small month with a dot on every day that has an occasion, the occasions coming up,
 * and a switch for each calendar. The search above looks through plans, occasions and notes.
 */

const HOUR = 52;
const DAY_MIN = 24 * 60;
const SNAP = 15;
const OCC = "#F2C94C";

type Span = 1 | 3 | 7;
type View = "cal" | "todo";
type Timed = {
  o: Occurrence;
  start: number;
  end: number;
  color: string;
  lane: number;
  lanes: number;
};
type Draft = { day: LocalDate; start: number; end: number };

const solarOf = (d: LocalDate) => fromJdn(dateToJdn(d), "solar-hijri");
const weekdayOf = (d: LocalDate): number => (dateToJdn(d) + 2) % 7;
const weekStart = (d: LocalDate): LocalDate => addDays(d, -weekdayOf(d));
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const dayMonth = (d: LocalDate): string => {
  const s = solarOf(d);
  return `${fa(String(s.day))} ${monthName(s)}`;
};
const hhmm = (m: number): string => fa(minutesToTime(clamp(m, 0, DAY_MIN - 1)));

/** Where an occurrence sits: minutes on its day, or null for the all-day row. */
function placeOf(o: Occurrence, day: LocalDate): { start: number; end: number } | null {
  const s = o.schedule;
  if (s.kind === "due") {
    if (s.due.time === undefined) return null;
    const start = timeToMinutes(s.due.time);
    return { start, end: Math.min(DAY_MIN, start + 30) };
  }
  if (s.start.time === undefined || s.end.time === undefined) return null;
  if (s.start.date !== s.end.date || s.start.date !== day) return null;
  const start = timeToMinutes(s.start.time);
  return { start, end: Math.max(start + 15, timeToMinutes(s.end.time)) };
}

/** Side by side when they overlap, as Google Calendar does. */
function lanes(items: Omit<Timed, "lane" | "lanes">[]): Timed[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Timed[] = [];
  let group: Timed[] = [];
  let groupEnd = -1;
  const close = (): void => {
    const n = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) g.lanes = n;
    group = [];
  };
  for (const it of sorted) {
    if (it.start >= groupEnd) close();
    const used = new Set(group.filter((g) => g.end > it.start).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const t: Timed = { ...it, lane, lanes: 1 };
    group.push(t);
    out.push(t);
    groupEnd = Math.max(groupEnd, it.end);
  }
  close();
  return out;
}

export function PlansSlide() {
  useRecordsVersion();
  const s = useSettings();
  const now = useNow(60_000);
  const local = localNow(TIME_ZONE, now);
  const todayD = today();
  const [view, setView] = useState<View>("cal");
  const [anchor, setAnchor] = useState<LocalDate>(todayD);
  const [span, setSpan] = useState<Span>(7);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);

  const first = span === 7 ? weekStart(anchor) : anchor;
  const days = Array.from({ length: span }, (_, i) => addDays(first, i));
  const hidden = new Set(s.hiddenCals);
  const lists = liveLists();
  const colorOf = new Map(lists.map((l) => [l.id, l.color]));
  const allTasks = liveTasks();
  const tasks = allTasks.filter((t) => !hidden.has(t.listId));
  const taskOf = new Map(allTasks.map((t) => [t.id, t]));
  const openCount = allTasks.filter((t) => t.status !== "done").length;
  const nowMin = timeToMinutes(local.time);

  // the hours open at eight in the morning, as the design's planner
  useLayoutEffect(() => {
    if (view === "cal" && body.current !== null) body.current.scrollTop = 8 * HOUR - 6;
  }, [view]);

  const toggle = (o: Occurrence): void => {
    const t = taskOf.get(o.taskId);
    if (t !== undefined) toggleTask({ occurrence: o, task: t, late: false });
  };
  const goTo = (d: LocalDate): void => {
    setView("cal");
    setAnchor(d);
  };

  const sFirst = solarOf(days[0] ?? anchor);
  const sLast = days.at(-1) ?? anchor;
  const sub =
    view === "todo"
      ? `${fa(String(openCount))} کار باز`
      : span === 1
        ? `${WEEKDAY_NAMES_FA[weekdayOf(first)] ?? ""} ${dayMonth(first)}`
        : `${span === 7 ? "هفته‌ی " : ""}${dayMonth(first)} تا ${dayMonth(sLast)}`;

  return (
    <div className={view === "todo" ? "s-pad plans-s todo-on" : "s-pad plans-s"}>
      <div className="pbar">
        <div className="ptitle">
          <b>
            {monthName(sFirst)} {fa(String(sFirst.year))}
          </b>
          <span>{sub}</span>
        </div>
        <div className="ptabs" role="tablist" aria-label="نما">
          <button
            type="button"
            role="tab"
            aria-selected={view === "cal"}
            onClick={() => {
              setView("cal");
            }}
          >
            تقویم
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "todo"}
            onClick={() => {
              setView("todo");
            }}
          >
            کارها <span>{fa(String(openCount))}</span>
          </button>
        </div>
        <PlanSearch tasks={allTasks} onDay={goTo} />
        {view === "cal" && (
          <div className="ptools">
            <div className="seg" role="radiogroup" aria-label="چند روز">
              {([1, 3, 7] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={span === n}
                  onClick={() => {
                    setSpan(n);
                  }}
                >
                  {n === 1 ? "روز" : n === 3 ? "۳ روز" : "هفته"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="rbtn sm"
              aria-label="قبلی"
              onClick={() => {
                setAnchor(addDays(anchor, -span));
              }}
            >
              <Icon name="arrow-left" className="flip" />
            </button>
            <button
              type="button"
              className="rbtn sm"
              aria-label="بعدی"
              onClick={() => {
                setAnchor(addDays(anchor, span));
              }}
            >
              <Icon name="arrow-left" />
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => {
                setAnchor(todayD);
                if (body.current !== null) body.current.scrollTop = 8 * HOUR - 6;
              }}
            >
              امروز
            </button>
          </div>
        )}
      </div>

      <aside className="card g side">
        <MiniMonth
          anchor={anchor}
          shown={view === "cal" ? days : []}
          todayD={todayD}
          onPick={goTo}
        />
        <div className="hr" />
        <div className="sec">مناسبت‌ها</div>
        <Upcoming from={todayD} onPick={goTo} />
        <div className="hr" />
        <div className="sec">تقویم‌ها</div>
        <div className="cals">
          <span className="cgrp">دسته‌های نقطه · همان دسته‌های اپ</span>
          {lists.map((l) => (
            <CalSwitch key={l.id} id={l.id} name={l.name} color={l.color} hidden={hidden} />
          ))}
          <span className="cgrp">دیگر</span>
          <CalSwitch id="occ" name="مناسبت‌ها" color={OCC} hidden={hidden} />
        </div>
      </aside>

      {view === "todo" ? (
        <TodoView tasks={allTasks} lists={lists} todayD={todayD} nowTime={local.time} />
      ) : (
        <div className="card g planner" style={{ "--days": span } as React.CSSProperties}>
          <div className="ph-row">
            <span />
            {days.map((d) => (
              <button
                key={d}
                type="button"
                className={[
                  "dcell",
                  weekdayOf(d) === 6 ? "fri" : "",
                  d === todayD ? "tdy" : "",
                ].join(" ")}
                onClick={() => {
                  setAnchor(d);
                  setSpan(1);
                }}
              >
                <span className="wn">{WEEKDAY_NAMES_FA[weekdayOf(d)]}</span>
                <b>{fa(String(solarOf(d).day))}</b>
              </button>
            ))}
          </div>
          <div className="ad-row">
            <span className="lbl">تمام‌روز</span>
            {days.map((d) => (
              <div key={d} className="acell">
                {!hidden.has("occ") &&
                  occasionsOn(dateToJdn(d)).map((oc) => (
                    <span
                      key={oc.event.id}
                      className={oc.event.holiday ? "chipd hol" : "chipd"}
                      title={oc.event.title}
                    >
                      {oc.event.title}
                    </span>
                  ))}
                {tasksOnDay(tasks, d)
                  .filter((o) => placeOf(o, d) === null)
                  .map((o) => {
                    const c = colorOf.get(taskOf.get(o.taskId)?.listId ?? "") ?? "#8C9EFF";
                    return (
                      <button
                        key={`${o.taskId}@${o.originalDate}`}
                        type="button"
                        className={o.status === "done" ? "chipd task done" : "chipd task"}
                        title={`${o.title} · ${o.status === "done" ? "برگرداندن" : "انجام شد"}`}
                        style={{ background: `${c}29`, color: c }}
                        onClick={() => {
                          toggle(o);
                        }}
                      >
                        {o.title}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
          <div className="pbody" ref={body}>
            <div className="pgrid">
              <div className="gut" style={{ height: 24 * HOUR }}>
                {Array.from({ length: 23 }, (_, i) => (
                  <span key={i} style={{ top: (i + 1) * HOUR }}>
                    {fa(`${String(i + 1).padStart(2, "0")}:۰۰`)}
                  </span>
                ))}
                {days.includes(todayD) && (
                  <span className="nowp" style={{ top: (nowMin / 60) * HOUR }}>
                    {hhmm(nowMin)}
                  </span>
                )}
              </div>
              {days.map((d) => (
                <DayColumn
                  key={d}
                  day={d}
                  isToday={d === todayD}
                  nowMin={nowMin}
                  timed={lanes(
                    tasksOnDay(tasks, d).flatMap((o) => {
                      const p = placeOf(o, d);
                      if (p === null) return [];
                      const c = colorOf.get(taskOf.get(o.taskId)?.listId ?? "") ?? "#8C9EFF";
                      return [{ o, ...p, color: c }];
                    }),
                  )}
                  draft={draft?.day === d ? draft : null}
                  picked={picked}
                  onPick={setPicked}
                  onToggle={toggle}
                  onDraft={setDraft}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {draft !== null && (
        <NewPlan
          draft={draft}
          lists={lists}
          onClose={() => {
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  nowMin,
  timed,
  draft,
  picked,
  onPick,
  onToggle,
  onDraft,
}: {
  day: LocalDate;
  isToday: boolean;
  nowMin: number;
  timed: Timed[];
  draft: Draft | null;
  picked: string | null;
  onPick: (key: string | null) => void;
  onToggle: (o: Occurrence) => void;
  onDraft: (d: Draft | null) => void;
}) {
  const col = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  // minutes at a pointer, from its share of the column (true whatever the page's zoom)
  const minuteAt = (clientY: number): number => {
    const r = col.current?.getBoundingClientRect();
    if (r === undefined) return 0;
    const m = ((clientY - r.top) / r.height) * DAY_MIN;
    return clamp(Math.round(m / SNAP) * SNAP, 0, DAY_MIN - SNAP);
  };

  // while dragging, the pointer is followed anywhere on the page until the button comes up
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent): void => {
      setDrag((d) => (d === null ? d : { ...d, to: minuteAt(e.clientY) }));
    };
    const up = (): void => {
      setDrag((d) => {
        if (d !== null) {
          const a = Math.min(d.from, d.to);
          const b = Math.max(d.from, d.to) + SNAP;
          // a click (or a short drag) makes an hour, as the design does
          onDraft({ day, start: a, end: Math.min(b - a < 30 ? a + 60 : b, DAY_MIN - 1) });
        }
        return null;
      });
    };
    addEventListener("mousemove", move);
    addEventListener("mouseup", up, { once: true });
    return () => {
      removeEventListener("mousemove", move);
      removeEventListener("mouseup", up);
    };
  }, [dragging]);

  const y = (m: number): number => (m / 60) * HOUR;
  const ghost =
    drag !== null
      ? { start: Math.min(drag.from, drag.to), end: Math.max(drag.from, drag.to) + SNAP }
      : draft;

  return (
    <div
      ref={col}
      className={isToday ? "pcol tdy" : "pcol"}
      style={{ height: 24 * HOUR }}
      onMouseDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        e.preventDefault();
        onPick(null);
        const m = minuteAt(e.clientY);
        setDrag({ from: m, to: m });
      }}
    >
      {timed.map((t) => {
        const key = `${t.o.taskId}@${t.o.originalDate}`;
        const h = Math.max(22, y(t.end - t.start) - 2);
        return (
          <div
            key={key}
            className={["ev", t.o.status === "done" ? "done" : "", picked === key ? "on" : ""].join(
              " ",
            )}
            style={{
              top: y(t.start) + 1,
              height: h,
              insetInlineStart: `calc(${String((t.lane / t.lanes) * 100)}% + 3px)`,
              width: `calc(${String(100 / t.lanes)}% - 6px)`,
              background: `${t.color}33`,
              borderColor: t.color,
            }}
            onClick={() => {
              onPick(picked === key ? null : key);
            }}
          >
            <b>{t.o.title}</b>
            {t.end - t.start >= 45 && (
              <small>
                <Icon name="time-circle" />
                <bdi>{hhmm(t.start)}</bdi> تا <bdi>{hhmm(t.end)}</bdi>
              </small>
            )}
            {picked === key && (
              <button
                type="button"
                className="ev-done"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(t.o);
                  onPick(null);
                }}
              >
                <Icon name="tick" />
                {t.o.status === "done" ? "برگرداندن" : "انجام شد"}
              </button>
            )}
          </div>
        );
      })}
      {ghost !== null && (
        <div
          className="ev ghost"
          style={{ top: y(ghost.start), height: Math.max(13, y(ghost.end - ghost.start)) }}
        >
          <small>
            <Icon name="time-circle" />
            <bdi>{hhmm(ghost.start)}</bdi> تا <bdi>{hhmm(ghost.end)}</bdi>
          </small>
        </div>
      )}
      {isToday && <div className="pnow" style={{ top: y(nowMin) }} />}
    </div>
  );
}

/**
 * «برنامه‌ی تازه»: nothing is saved on the drag itself; this asks for the title and the list, as the
 * app's sheet does, and the plan becomes a نقطه task at that time (so it is on the phone too).
 */
function NewPlan({
  draft,
  lists,
  onClose,
}: {
  draft: Draft;
  lists: readonly TaskList[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const usable = lists.filter((l) => l.kind !== "shopping");
  const [listId, setListId] = useState(usable.find((l) => l.isDefault)?.id ?? usable[0]?.id);
  const save = (): void => {
    if (title.trim() === "") return;
    addTimedTask(title, draft.day, minutesToTime(draft.start), minutesToTime(draft.end), listId);
    onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal sm" role="dialog" aria-modal="true" aria-labelledby="evTitle">
        <div className="card-h">
          <h2 id="evTitle">برنامه‌ی تازه</h2>
          <button type="button" className="rbtn sm" aria-label="بستن" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="ef">
          <div className="when">
            <Icon name="time-circle" />
            <span>
              {WEEKDAY_NAMES_FA[weekdayOf(draft.day)]} {dayMonth(draft.day)} ·{" "}
              <b>{hhmm(draft.start)}</b> تا <b>{hhmm(draft.end)}</b>
            </span>
          </div>
          <input
            className="big"
            autoFocus
            value={title}
            maxLength={80}
            placeholder="عنوان برنامه"
            aria-label="عنوان برنامه"
            autoComplete="off"
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
          />
          {usable.length > 0 && (
            <>
              <div className="sec">دسته</div>
              <div className="lchips">
                {usable.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={l.id === listId}
                    onClick={() => {
                      setListId(l.id);
                    }}
                  >
                    <i style={{ background: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="mfoot">
          <span className="cnt">روی گوشی هم همین‌جا می‌نشیند</span>
          <button type="button" className="cta" disabled={title.trim() === ""} onClick={save}>
            ساختن
          </button>
        </div>
      </div>
    </div>
  );
}

type Row = { key: string; o: Occurrence | null; task: Task; meta: string; late: boolean };

/** «کارها»: the open tasks by when they are due, one list or all, with the done ones folded away. */
function TodoView({
  tasks,
  lists,
  todayD,
  nowTime,
}: {
  tasks: readonly Task[];
  lists: readonly TaskList[];
  todayD: LocalDate;
  nowTime: string;
}) {
  const [only, setOnly] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState("");
  const colorOf = new Map(lists.map((l) => [l.id, l.color]));
  const inList = tasks.filter((t) => only === null || t.listId === only);
  const target = lists.find((l) => l.id === only) ?? lists.find((l) => l.isDefault) ?? lists[0];

  const when = (o: Occurrence): string => {
    const s = o.schedule;
    // a plan still ahead shows when it starts; one under way, when it ends
    const p =
      s.kind === "due" ? s.due : dateToJdn(s.start.date) > dateToJdn(todayD) ? s.start : s.end;
    if (p.date === todayD) return p.time !== undefined ? fa(p.time) : "";
    const days = dateToJdn(p.date) - dateToJdn(todayD);
    if (s.kind === "range" && dateToJdn(s.start.date) <= dateToJdn(todayD) && days > 0)
      return `تا ${WEEKDAY_NAMES_FA[weekdayOf(p.date)] ?? ""}`;
    const t = p.time !== undefined ? ` ${fa(p.time)}` : "";
    if (days > 0 && days < 7) return `${WEEKDAY_NAMES_FA[weekdayOf(p.date)] ?? ""}${t}`;
    return dayMonth(p.date);
  };
  const row = (o: Occurrence, late = false): Row | null => {
    const task = inList.find((t) => t.id === o.taskId);
    return task === undefined
      ? null
      : { key: `${o.taskId}@${o.originalDate}`, o, task, meta: when(o), late };
  };

  const late = overdue(inList, { date: todayD, time: nowTime }).flatMap((o) => row(o, true) ?? []);
  const todayRows = tasksOnDay(inList, todayD).flatMap((o) => row(o) ?? []);
  const seen = new Set([...late, ...todayRows].map((r) => r.task.id));
  const later: Row[] = [];
  for (const t of inList) {
    if (seen.has(t.id)) continue;
    const next = expandOccurrences(t, { from: addDays(todayD, 1), to: addDays(todayD, 400) }).find(
      (o) => o.status !== "done",
    );
    const r = next === undefined ? null : row(next);
    if (r !== null) later.push(r);
  }
  later.sort((a, b) => (a.o?.originalDate ?? "").localeCompare(b.o?.originalDate ?? ""));
  const noDate = unscheduled(inList).map((task): Row => ({
    key: task.id,
    o: null,
    task,
    meta: "",
    late: false,
  }));
  const isDone = (r: Row): boolean => (r.o?.status ?? r.task.status) === "done";
  const doneCount = [...todayRows, ...noDate].filter(isDone).length;
  const keep = (rs: Row[]): Row[] => (showDone ? rs : rs.filter((r) => !isDone(r)));

  const sections: [string, string, Row[]][] = [
    ["late", "عقب‌افتاده", keep(late)],
    ["today", "امروز", keep(todayRows)],
    ["later", "پیش رو", keep(later)],
    ["nodate", "بدون تاریخ", keep(noDate)],
  ];
  const openIn = (id: string | null): number =>
    tasks.filter((t) => t.status !== "done" && (id === null || t.listId === id)).length;

  return (
    <div className="card g todo">
      <div className="td-top">
        <div className="td-f">
          <button
            type="button"
            aria-pressed={only === null}
            onClick={() => {
              setOnly(null);
            }}
          >
            همه <small>{fa(String(openIn(null)))}</small>
          </button>
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={only === l.id}
              onClick={() => {
                setOnly(l.id);
              }}
            >
              <i style={{ background: l.color }} />
              {l.name} <small>{fa(String(openIn(l.id)))}</small>
            </button>
          ))}
        </div>
        <form
          className="td-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim() === "") return;
            addTask(draft, target === undefined ? {} : { listId: target.id });
            setDraft("");
          }}
        >
          <Icon name="plus" />
          <input
            value={draft}
            placeholder="کار تازه… (Enter)"
            autoComplete="off"
            aria-label="کار تازه"
            onChange={(e) => {
              setDraft(e.target.value);
            }}
          />
          <span className="td-in">در «{target?.name ?? "شخصی"}»</span>
        </form>
      </div>
      <div className="td-list">
        {sections.every(([, , rs]) => rs.length === 0) && doneCount === 0 ? (
          <p className="td-none">کاری در این دسته نیست.</p>
        ) : (
          sections.map(([key, title, rs]) =>
            rs.length === 0 ? null : (
              <div key={key} className={key === "late" ? "td-sec late" : "td-sec"}>
                <h4>
                  {title} <small>{fa(String(rs.length))}</small>
                </h4>
                {rs.map((r) => {
                  const done = isDone(r);
                  return (
                    <div key={r.key} className={done ? "td-row done" : "td-row"}>
                      <button
                        type="button"
                        className="cb"
                        aria-label={done ? "برگرداندن" : "انجام شد"}
                        aria-pressed={done}
                        onClick={() => {
                          toggleTask({ occurrence: r.o, task: r.task, late: r.late });
                        }}
                      >
                        <Icon name="tick" />
                      </button>
                      <span
                        className="ld"
                        style={{ background: colorOf.get(r.task.listId) ?? "#8C9EFF" }}
                      />
                      <span className="t">{r.task.title}</span>
                      <span className={r.late ? "m late" : "m"}>{r.meta}</span>
                    </div>
                  );
                })}
              </div>
            ),
          )
        )}
        {doneCount > 0 && (
          <button
            type="button"
            className="td-done"
            onClick={() => {
              setShowDone(!showDone);
            }}
          >
            {showDone ? "پنهان کردن" : "نمایش"} {fa(String(doneCount))} انجام‌شده
          </button>
        )}
      </div>
    </div>
  );
}

/** One search over plans, occasions and notes, as the design's: the first few, with their day. */
function PlanSearch({ tasks, onDay }: { tasks: readonly Task[]; onDay: (d: LocalDate) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  type Hit = { key: string; title: string; color: string; meta: string; go: () => void };
  const hits: Hit[] = [];
  const query = normalize(q);
  if (query !== "") {
    const todayD = today();
    for (const t of tasks) {
      if (hits.length >= 4) break;
      if (!normalize(t.title).includes(query)) continue;
      const o = expandOccurrences(t, { from: addDays(todayD, -60), to: addDays(todayD, 400) }).find(
        (x) => x.originalDate >= todayD,
      );
      const d = o?.originalDate;
      hits.push({
        key: `t${t.id}`,
        title: t.title,
        color: "#8C9EFF",
        meta: d === undefined ? "کار" : dayMonth(d),
        go: () => {
          if (d !== undefined) onDay(d);
        },
      });
    }
    const j0 = dateToJdn(todayD);
    for (let i = 0; i < 370 && hits.length < 6; i++) {
      for (const oc of occasionsOn(j0 + i)) {
        if (!normalize(oc.event.title).includes(query)) continue;
        const d = jdnToDate(j0 + i);
        hits.push({
          key: `o${oc.event.id}${String(i)}`,
          title: oc.event.title,
          color: OCC,
          meta: dayMonth(d),
          go: () => {
            onDay(d);
          },
        });
        break;
      }
    }
    for (const n of searchNotes(liveNotes(), q).slice(0, 7 - hits.length)) {
      hits.push({
        key: `n${n.id}`,
        title: noteTitle(n),
        color: "#B79CF0",
        meta: "یادداشت",
        go: () => {
          document.getElementById("s-notes")?.scrollIntoView({ behavior: "smooth" });
        },
      });
    }
  }
  return (
    <div className="psearch">
      <Icon name="search" />
      <input
        value={q}
        placeholder="جستجو در برنامه‌ها، مناسبت‌ها و یادداشت‌ها…"
        autoComplete="off"
        aria-label="جستجو در برنامه‌ها"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
        }}
      />
      {open && query !== "" && (
        <div
          className="pdrop"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          {hits.length === 0 ? (
            <div className="empty">چیزی با «{q.trim()}» پیدا نشد.</div>
          ) : (
            hits.map((h) => (
              <button
                key={h.key}
                type="button"
                onClick={() => {
                  h.go();
                  setOpen(false);
                }}
              >
                <i style={{ background: h.color }} />
                {h.title}
                <span>{h.meta}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** The month of the day in view, with the shown days marked and a dot on days with an occasion. */
function MiniMonth({
  anchor,
  shown,
  todayD,
  onPick,
}: {
  anchor: LocalDate;
  shown: LocalDate[];
  todayD: LocalDate;
  onPick: (d: LocalDate) => void;
}) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    setOffset(0);
  }, [anchor]);
  const base = solarOf(anchor);
  const m0 = base.month - 1 + offset;
  const year = base.year + Math.floor(m0 / 12);
  const month = (((m0 % 12) + 12) % 12) + 1;
  const firstJ = toJdn({ calendar: "solar-hijri", year, month, day: 1 });
  const pad = (firstJ + 2) % 7;
  const n = daysInMonth("solar-hijri", year, month);
  const g0 = fromJdn(firstJ, "gregorian");
  const g1 = fromJdn(firstJ + n - 1, "gregorian");
  const inView = new Set(shown);
  return (
    <div className="mini">
      <div className="mini-h">
        <b>
          {monthName({ calendar: "solar-hijri", year, month, day: 1 })} {fa(String(year))}
        </b>
        <span>
          {monthName(g0)}
          {g0.month !== g1.month ? `–${monthName(g1)}` : ""} {fa(String(g1.year))}
        </span>
        <span className="mini-nav">
          <button
            type="button"
            aria-label="ماه قبل"
            onClick={() => {
              setOffset(offset - 1);
            }}
          >
            <Icon name="arrow-left" className="flip" />
          </button>
          <button
            type="button"
            aria-label="ماه بعد"
            onClick={() => {
              setOffset(offset + 1);
            }}
          >
            <Icon name="arrow-left" />
          </button>
        </span>
      </div>
      <div className="mini-wk">
        {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mini-g">
        {Array.from({ length: pad }, (_, i) => (
          <span key={`p${String(i)}`} />
        ))}
        {Array.from({ length: n }, (_, i) => {
          const j = firstJ + i;
          const d = jdnToDate(j);
          const occ = occasionsOn(j);
          const shownHere = inView.has(d);
          return (
            <button
              key={d}
              type="button"
              className={[
                (j + 2) % 7 === 6 || occ.some((o) => o.event.holiday) ? "fri" : "",
                d === todayD ? "tdy" : "",
                shownHere ? "inwk" : "",
                // the band is rounded wherever it ends in this grid: the view's edge, a row's, the month's
                shownHere && (i === 0 || (j + 2) % 7 === 0 || !inView.has(jdnToDate(j - 1)))
                  ? "ws"
                  : "",
                shownHere && (i === n - 1 || (j + 2) % 7 === 6 || !inView.has(jdnToDate(j + 1)))
                  ? "we"
                  : "",
              ].join(" ")}
              onClick={() => {
                onPick(d);
              }}
            >
              <span className="nn">{fa(String(i + 1))}</span>
              {occ.length > 0 && <i />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The next few occasions from today, with their day. */
function Upcoming({ from, onPick }: { from: LocalDate; onPick: (d: LocalDate) => void }) {
  const out: { d: LocalDate; title: string; holiday: boolean; key: string }[] = [];
  const j0 = dateToJdn(from);
  for (let i = 0; i < 40 && out.length < 4; i++) {
    for (const o of occasionsOn(j0 + i)) {
      if (out.length >= 4) break;
      out.push({
        d: jdnToDate(j0 + i),
        title: o.event.title,
        holiday: o.event.holiday,
        key: `${String(i)}-${o.event.id}`,
      });
    }
  }
  return (
    <div className="occl">
      {out.map((o) => (
        <button
          key={o.key}
          type="button"
          className={o.d === from ? "now" : ""}
          onClick={() => {
            onPick(o.d);
          }}
        >
          <span className="dt">{o.d === from ? "امروز" : dayMonth(o.d)}</span>
          <span className={o.holiday ? "ot hol" : "ot"}>{o.title}</span>
        </button>
      ))}
    </div>
  );
}

function CalSwitch({
  id,
  name,
  color,
  hidden,
}: {
  id: string;
  name: string;
  color: string;
  hidden: ReadonlySet<string>;
}) {
  const on = !hidden.has(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        updateSettings({ hiddenCals: on ? [...hidden, id] : [...hidden].filter((x) => x !== id) });
      }}
    >
      <span className="bx" style={{ borderColor: color, background: on ? color : "transparent" }}>
        <Icon name="tick" />
      </span>
      {name}
    </button>
  );
}
