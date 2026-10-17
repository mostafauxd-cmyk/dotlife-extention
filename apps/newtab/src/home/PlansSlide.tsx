import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";

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
  taskLists,
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
import { AD_LABEL, useAd } from "../ads";
import { Tabs } from "../ui/Tabs";
import { openNewCategory } from "./NewCategory";
import { openEditor } from "./TaskEditor";
import {
  connectGoogle,
  useGoogle,
  useGoogleCalendars,
  useGoogleEvents,
  type GEvent,
} from "../google";

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
/** One block on a day's hours: a نقطه task's occurrence or a Google event. */
type Timed = {
  key: string;
  title: string;
  done: boolean;
  start: number;
  end: number;
  color: string;
  open: () => void;
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

/** Where a Google event sits on a day: minutes, «all day» (true), or not on it (null). */
function gPlaceOf(e: GEvent, day: LocalDate): { start: number; end: number } | true | null {
  if (e.allDay) return e.start <= day && day < e.end ? true : null;
  const a = localNow(TIME_ZONE, new Date(e.start));
  const b = localNow(TIME_ZONE, new Date(e.end));
  if (a.date === day && b.date === day) {
    const start = timeToMinutes(a.time);
    return { start, end: Math.max(start + 15, timeToMinutes(b.time)) };
  }
  // a timed event over several days sits in the whole-day row of each
  return a.date <= day && day <= b.date && !(b.date === day && b.time === "00:00") ? true : null;
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
  /** A line under the Google button for a moment: why it cannot connect here, or that it failed. */
  const [gHint, setGHint] = useState<string | null>(null);
  useEffect(() => {
    if (gHint === null) return;
    const t = setTimeout(() => {
      setGHint(null);
    }, 4500);
    return () => {
      clearTimeout(t);
    };
  }, [gHint]);
  const [anchor, setAnchor] = useState<LocalDate>(todayD);
  const [span, setSpan] = useState<Span>(7);
  const body = useRef<HTMLDivElement>(null);

  const first = span === 7 ? weekStart(anchor) : anchor;
  const days = Array.from({ length: span }, (_, i) => addDays(first, i));
  const hidden = new Set(s.hiddenCals);
  // the saved news are notes only: no switch, no column of their own
  const lists = taskLists();
  const colorOf = new Map(lists.map((l) => [l.id, l.color]));
  const allTasks = liveTasks();
  const tasks = allTasks.filter((t) => !hidden.has(t.listId));
  const taskOf = new Map(allTasks.map((t) => [t.id, t]));
  const google = useGoogle();
  const gcals = useGoogleCalendars();
  const gColor = new Map(gcals.map((c) => [c.id, c.color]));
  const gEvents = useGoogleEvents(
    first,
    addDays(first, span - 1),
    gcals.filter((c) => !hidden.has(`g:${c.id}`)).map((c) => c.id),
  );
  const openCount = allTasks.filter((t) => t.status !== "done").length;
  const nowMin = timeToMinutes(local.time);

  // the hours open at eight in the morning, as the design's planner
  useLayoutEffect(() => {
    if (view === "cal" && body.current !== null) body.current.scrollTop = 8 * HOUR - 6;
  }, [view]);

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
        <Tabs
          label="نما"
          width={250}
          value={view}
          onChange={setView}
          items={[
            { id: "cal", label: "تقویم" },
            { id: "todo", label: "کارها", count: fa(String(openCount)) },
          ]}
        />
        <PlanSearch tasks={allTasks} onDay={goTo} />
        {/* always shown (the user, 2026-10-17, looking at the preview: «یک دکمه که ببره توی auth
            گوگل»); outside the installed extension Chrome's sign-in window does not exist, so there
            it is dimmed and says why */}
        <span className="gwrap">
          <button
            type="button"
            className={
              google.status === "on"
                ? "gsync on"
                : google.status === "unavailable"
                  ? "gsync na"
                  : "gsync"
            }
            aria-disabled={google.status === "unavailable"}
            title={
              google.status === "on"
                ? (google.email ?? "")
                : google.status === "unavailable"
                  ? "اتصال گوگل فقط در افزونه‌ی نصب‌شده در کروم کار می‌کند"
                  : "تقویم گوگل و گوگل میت"
            }
            onClick={() => {
              if (google.status === "unavailable") {
                setGHint("اتصال گوگل فقط در افزونه‌ی نصب‌شده در کروم کار می‌کند.");
                return;
              }
              if (google.status === "on") return;
              setGHint(null);
              void connectGoogle().then((ok) => {
                if (!ok) setGHint("به گوگل وصل نشد. دوباره امتحان کن.");
              });
            }}
          >
            <svg className="glogo" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            {google.status === "on"
              ? "همگام با تقویم گوگل"
              : google.status === "expired"
                ? "دوباره به گوگل وصل شو"
                : "اتصال تقویم گوگل"}
          </button>
          {gHint === null ? null : (
            <span className="ghint" role="status">
              {gHint}
            </span>
          )}
        </span>
        {view === "cal" && (
          <div className="ptools">
            <Tabs
              label="چند روز"
              value={span}
              onChange={setSpan}
              items={[
                { id: 1, label: "روز" },
                { id: 3, label: "۳ روز" },
                { id: 7, label: "هفته" },
              ]}
            />
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
        <CityEvent />
        <div className="hr" />
        <div className="sec">تقویم‌ها</div>
        <div className="cals">
          <span className="cgrp">دسته‌های نقطه · همان دسته‌های اپ</span>
          {lists.map((l) => (
            <CalSwitch key={l.id} id={l.id} name={l.name} color={l.color} hidden={hidden} />
          ))}
          <button type="button" className="calnew" onClick={() => openNewCategory()}>
            <Icon name="plus" />
            دسته‌ی تازه
          </button>
          {gcals.length > 0 && (
            <>
              <span className="cgrp">
                تقویم گوگل{google.status === "on" && google.email ? ` · ${google.email}` : ""}
              </span>
              {gcals.map((c) => (
                <CalSwitch
                  key={c.id}
                  id={`g:${c.id}`}
                  name={c.name}
                  color={c.color}
                  hidden={hidden}
                />
              ))}
            </>
          )}
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
                        title={o.title}
                        style={{ background: `${c}29`, color: c }}
                        onClick={() => {
                          const t = taskOf.get(o.taskId);
                          if (t !== undefined) openEditor({ mode: "edit", task: t, occurrence: o });
                        }}
                      >
                        {o.title}
                      </button>
                    );
                  })}
                {gEvents
                  .filter((e) => gPlaceOf(e, d) === true)
                  .map((e) => {
                    const c = gColor.get(e.calendarId) ?? "#5AB0FF";
                    return (
                      <button
                        key={e.key}
                        type="button"
                        className="chipd task g"
                        title={e.title}
                        style={{ background: `${c}29`, color: c }}
                        onClick={() => {
                          openEditor({ mode: "event", event: e });
                        }}
                      >
                        {e.title}
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
                  timed={lanes([
                    ...tasksOnDay(tasks, d).flatMap((o) => {
                      const p = placeOf(o, d);
                      const t = taskOf.get(o.taskId);
                      if (p === null || t === undefined) return [];
                      return [
                        {
                          key: `${o.taskId}@${o.originalDate}`,
                          title: o.title,
                          done: o.status === "done",
                          ...p,
                          color: colorOf.get(t.listId) ?? "#8C9EFF",
                          open: () => {
                            openEditor({ mode: "edit", task: t, occurrence: o });
                          },
                        },
                      ];
                    }),
                    ...gEvents.flatMap((e) => {
                      const p = gPlaceOf(e, d);
                      if (p === null || p === true) return [];
                      return [
                        {
                          key: e.key,
                          title: e.title,
                          done: false,
                          ...p,
                          color: gColor.get(e.calendarId) ?? "#5AB0FF",
                          open: () => {
                            openEditor({ mode: "event", event: e });
                          },
                        },
                      ];
                    }),
                  ])}
                  onNew={(d2) => {
                    openEditor({ mode: "new", date: d2.day, start: d2.start, end: d2.end });
                  }}
                />
              ))}
              {/* «now»: one line across every day, from its time in the gutter */}
              {days.includes(todayD) && (
                <div className="pnow" style={{ top: (nowMin / 60) * HOUR }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  timed,
  onNew,
}: {
  day: LocalDate;
  isToday: boolean;
  timed: Timed[];
  onNew: (d: Draft) => void;
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
          onNew({ day, start: a, end: Math.min(b - a < 30 ? a + 60 : b, DAY_MIN - 1) });
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
      : null;

  return (
    <div
      ref={col}
      className={isToday ? "pcol tdy" : "pcol"}
      style={{ height: 24 * HOUR }}
      onMouseDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        e.preventDefault();
        const m = minuteAt(e.clientY);
        setDrag({ from: m, to: m });
      }}
    >
      {timed.map((t) => {
        const h = Math.max(22, y(t.end - t.start) - 2);
        return (
          <div
            key={t.key}
            className={t.done ? "ev done" : "ev"}
            style={{
              top: y(t.start) + 1,
              height: h,
              insetInlineStart: `calc(${String((t.lane / t.lanes) * 100)}% + 3px)`,
              width: `calc(${String(100 / t.lanes)}% - 6px)`,
              background: `${t.color}33`,
              borderColor: t.color,
            }}
            onClick={() => {
              t.open();
            }}
          >
            <b>{t.title}</b>
            {t.end - t.start >= 45 && (
              <small>
                <Icon name="time-circle" />
                <bdi>{hhmm(t.start)}</bdi> تا <bdi>{hhmm(t.end)}</bdi>
              </small>
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
        <div className="td-f morph">
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
          <button
            type="button"
            className="tdnew"
            aria-label="دسته‌ی تازه"
            title="دسته‌ی تازه"
            onClick={() => {
              openNewCategory((l) => {
                setOnly(l.id);
              });
            }}
          >
            <Icon name="plus" />
          </button>
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
                      <button
                        type="button"
                        className="t"
                        onClick={() => {
                          openEditor({ mode: "edit", task: r.task, occurrence: r.o });
                        }}
                      >
                        {r.o?.title ?? r.task.title}
                      </button>
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
  // slot 9: the last row of the results, aimed only by the typed word
  const sponsored = useAd(9, { keyword: q });
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
        placeholder="جستجو"
        autoComplete="off"
        aria-label="جستجو در برنامه‌ها، مناسبت‌ها و یادداشت‌ها"
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
          {sponsored !== null && (
            <a className="sprow" href={sponsored.url} target="_blank" rel="noreferrer">
              <i />
              {sponsored.title}
              <span className="tag">{AD_LABEL}</span>
            </a>
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
        <div className="mini-t">
          <b>
            {monthName({ calendar: "solar-hijri", year, month, day: 1 })} {fa(String(year))}
          </b>
          <span>
            {monthName(g0)}
            {g0.month !== g1.month ? ` – ${monthName(g1)}` : ""} {fa(String(g1.year))}
          </span>
        </div>
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
  const ad = useAd(8);
  // slot 8 sits right under the first occasion that is not today's
  const at = Math.max(
    0,
    out.findIndex((o) => o.d !== from),
  );
  return (
    <div className="occl">
      {out.map((o, i) => (
        <Fragment key={o.key}>
          <button
            type="button"
            className={o.d === from ? "now" : ""}
            onClick={() => {
              onPick(o.d);
            }}
          >
            <span className="dt">{o.d === from ? "امروز" : dayMonth(o.d)}</span>
            <span className={o.holiday ? "ot hol" : "ot"}>{o.title}</span>
          </button>
          {ad !== null && i === at && (
            <a className="occsp row" href={ad.url} target="_blank" rel="noreferrer">
              {ad.title}
              <span className="tag">{AD_LABEL}</span>
            </a>
          )}
        </Fragment>
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

/** Slot 7: a show or concert in the city; «+ برنامه» puts it on the person's own plans. */
function CityEvent() {
  const ad = useAd(7);
  if (ad === null) return null;
  const date = ad.extra?.date;
  return (
    <div className="spev">
      <span className="pst" style={{ background: ad.tint ?? "#8C9EFF" }}>
        {ad.extra?.kind ?? ad.glyph ?? ""}
      </span>
      <div>
        <b>{ad.title}</b>
        <span>
          {ad.line}
          <span className="tag">{AD_LABEL}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          addTask(ad.title, {
            day: date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
          });
        }}
      >
        {ad.cta ?? "+ برنامه"}
      </button>
    </div>
  );
}
