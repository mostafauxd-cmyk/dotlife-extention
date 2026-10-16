import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { daysInMonth, fromJdn, monthName, toJdn, WEEKDAY_NAMES_FA } from "@dotlife/calendar-core";
import {
  addDays,
  dateToJdn,
  jdnToDate,
  localNow,
  minutesToTime,
  tasksOnDay,
  timeToMinutes,
  type LocalDate,
  type Occurrence,
} from "@dotlife/tasks";

import { useNow, useRecordsVersion, useSettings } from "../hooks";
import { addTimedTask, liveLists, liveTasks, TIME_ZONE, today, toggleTask } from "../noghte/model";
import { updateSettings } from "../settings";
import { occasionsOn, prayersOn } from "../today";
import { fa } from "../ui/fa";
import { Icon } from "../ui/Icon";

/**
 * The plans slide, as the app's «برنامه‌ها»: a week (or three days, or one) in Google Calendar's
 * manner. Each day a column of hours with the day's timed tasks, the dawn, noon and sunset adhans
 * as dashed lines and «now» as a white one; above them a row for the whole day — occasions and
 * tasks with no time. Beside it a small month with a dot on every day that has an occasion, the
 * occasions coming up, and a switch for each calendar. Dragging over the hours makes a task there.
 */

const HOUR = 52;
const DAY_MIN = 24 * 60;
const SNAP = 15;
const OCC = "#F2C94C";

type Span = 1 | 3 | 7;
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
const weekStart = (d: LocalDate): LocalDate => {
  const j = dateToJdn(d);
  return jdnToDate(j - ((j + 2) % 7));
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Where an occurrence sits: minutes on its day, or null for the all-day row. */
function placeOf(o: Occurrence, day: LocalDate): { start: number; end: number } | null {
  const s = o.schedule;
  if (s.kind === "due") {
    if (s.due.time === undefined) return null;
    const start = timeToMinutes(s.due.time);
    return { start, end: Math.min(DAY_MIN, start + 30) };
  }
  if (s.start.time === undefined || s.end.time === undefined) return null;
  if (s.start.date !== s.end.date) return null;
  if (s.start.date !== day) return null;
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
  const tasks = liveTasks().filter((t) => !hidden.has(t.listId));
  const taskOf = new Map(tasks.map((t) => [t.id, t]));

  // the hours open at the morning, or an hour before now
  useLayoutEffect(() => {
    const el = body.current;
    if (el === null) return;
    const h = Number(local.time.slice(0, 2));
    el.scrollTop = Math.max(0, (h >= 8 ? h - 1 : 7) * HOUR);
  }, []); // only when the slide is first drawn

  const toggle = (o: Occurrence): void => {
    const t = taskOf.get(o.taskId);
    if (t !== undefined) toggleTask({ occurrence: o, task: t, late: false });
  };

  const sFirst = solarOf(days[0] ?? anchor);
  const sLast = solarOf(days.at(-1) ?? anchor);
  const title = `${monthName(sFirst)} ${fa(String(sFirst.year))}`;
  const sub =
    span === 1
      ? `${WEEKDAY_NAMES_FA[(dateToJdn(first) + 2) % 7] ?? ""} ${fa(String(sFirst.day))} ${monthName(sFirst)}`
      : `${fa(String(sFirst.day))} ${monthName(sFirst)} تا ${fa(String(sLast.day))} ${monthName(sLast)}`;

  return (
    <div className="s-pad plans-s">
      <div className="pbar">
        <div className="ptitle">
          <b>{title}</b>
          <span>{span === 7 ? `هفته‌ی ${sub}` : sub}</span>
        </div>
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
            }}
          >
            امروز
          </button>
        </div>
      </div>

      <aside className="card g side">
        <MiniMonth anchor={anchor} shown={days} todayD={todayD} onPick={setAnchor} />
        <div className="hr" />
        <div className="sec">مناسبت‌ها</div>
        <Upcoming from={todayD} onPick={setAnchor} />
        <div className="hr" />
        <div className="sec">تقویم‌ها</div>
        <div className="cals">
          <span className="cgrp">دسته‌های نقطه</span>
          {lists.map((l) => (
            <CalSwitch key={l.id} id={l.id} name={l.name} color={l.color} hidden={hidden} />
          ))}
          <span className="cgrp">دیگر</span>
          <CalSwitch id="occ" name="مناسبت‌ها" color={OCC} hidden={hidden} />
          <CalSwitch id="pr" name="اوقات شرعی" color="#C9CBD2" hidden={hidden} />
        </div>
      </aside>

      <div className="card g planner" style={{ "--days": span } as React.CSSProperties}>
        <div className="ph-row">
          <span />
          {days.map((d) => {
            const sd = solarOf(d);
            const wd = (dateToJdn(d) + 2) % 7;
            return (
              <button
                key={d}
                type="button"
                className={["dcell", wd === 6 ? "fri" : "", d === todayD ? "tdy" : ""].join(" ")}
                onClick={() => {
                  setAnchor(d);
                  setSpan(1);
                }}
              >
                {WEEKDAY_NAMES_FA[wd]}
                <b>{fa(String(sd.day))}</b>
              </button>
            );
          })}
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
                      title={o.status === "done" ? "برگرداندن" : "انجام شد"}
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
            </div>
            {days.map((d) => (
              <DayColumn
                key={d}
                day={d}
                isToday={d === todayD}
                nowMin={timeToMinutes(local.time)}
                timed={lanes(
                  tasksOnDay(tasks, d).flatMap((o) => {
                    const p = placeOf(o, d);
                    if (p === null) return [];
                    const c = colorOf.get(taskOf.get(o.taskId)?.listId ?? "") ?? "#8C9EFF";
                    return [{ o, ...p, color: c }];
                  }),
                )}
                prayers={hidden.has("pr") ? [] : prayersOn(d)}
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
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  nowMin,
  timed,
  prayers,
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
  prayers: { name: string; minutes: number }[];
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
    return clamp(Math.round(m / SNAP) * SNAP, 0, DAY_MIN);
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
          const b = Math.max(d.from, d.to);
          onDraft({ day, start: a, end: Math.max(b, a + 30) });
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
  const shown =
    drag === null
      ? null
      : { start: Math.min(drag.from, drag.to), end: Math.max(drag.from, drag.to) };

  return (
    <div
      ref={col}
      className={isToday ? "pcol tdy" : "pcol"}
      style={{ height: 24 * HOUR }}
      onMouseDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return;
        e.preventDefault();
        onPick(null);
        onDraft(null);
        const m = minuteAt(e.clientY);
        setDrag({ from: m, to: m + 30 });
      }}
    >
      {prayers.map((p) => (
        <div key={p.name} className="prl" style={{ top: y(p.minutes) }}>
          <span>
            {p.name} {fa(minutesToTime(Math.round(p.minutes)))}
          </span>
        </div>
      ))}
      {timed.map((t) => {
        const key = `${t.o.taskId}@${t.o.originalDate}`;
        const h = Math.max(24, y(t.end - t.start) - 2);
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
              borderInlineStartColor: t.color,
            }}
            onClick={() => {
              onPick(picked === key ? null : key);
            }}
          >
            <b>{t.o.title}</b>
            {h >= 44 && (
              <small>
                {fa(minutesToTime(t.start))} تا {fa(minutesToTime(Math.min(t.end, DAY_MIN - 1)))}
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
      {shown !== null && (
        <div
          className="ev ghost"
          style={{ top: y(shown.start), height: Math.max(12, y(shown.end - shown.start)) }}
        >
          <small>
            {fa(minutesToTime(shown.start))} تا{" "}
            {fa(minutesToTime(Math.min(shown.end, DAY_MIN - 1)))}
          </small>
        </div>
      )}
      {draft !== null && (
        <div
          className="ev draft"
          style={{ top: y(draft.start), height: Math.max(52, y(draft.end - draft.start)) }}
        >
          <input
            autoFocus
            placeholder="برنامه‌ی تازه…"
            aria-label="عنوان برنامه‌ی تازه"
            onKeyDown={(e) => {
              const v = e.currentTarget.value.trim();
              if (e.key === "Enter" && v !== "") {
                addTimedTask(
                  v,
                  draft.day,
                  minutesToTime(draft.start),
                  minutesToTime(Math.min(draft.end, DAY_MIN - 1)),
                );
                onDraft(null);
              } else if (e.key === "Escape") onDraft(null);
            }}
            onBlur={() => {
              onDraft(null);
            }}
          />
          <small>
            {fa(minutesToTime(draft.start))} تا{" "}
            {fa(minutesToTime(Math.min(draft.end, DAY_MIN - 1)))}
          </small>
        </div>
      )}
      {isToday && (
        <div className="pnow" style={{ top: y(nowMin) }}>
          <i />
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
          const wd = (j + 2) % 7;
          const occ = occasionsOn(j);
          return (
            <button
              key={d}
              type="button"
              className={[
                wd === 6 || occ.some((o) => o.event.holiday) ? "fri" : "",
                d === todayD ? "tdy" : "",
                inView.has(d) ? "inwk" : "",
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
  for (let i = 0; i < 40 && out.length < 5; i++) {
    for (const o of occasionsOn(j0 + i)) {
      if (out.length >= 5) break;
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
      {out.map((o) => {
        const sd = solarOf(o.d);
        return (
          <button
            key={o.key}
            type="button"
            className={o.d === from ? "now" : ""}
            onClick={() => {
              onPick(o.d);
            }}
          >
            <span className="dt">
              {o.d === from ? "امروز" : `${fa(String(sd.day))} ${monthName(sd)}`}
            </span>
            <span className={o.holiday ? "ot hol" : "ot"}>{o.title}</span>
          </button>
        );
      })}
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
