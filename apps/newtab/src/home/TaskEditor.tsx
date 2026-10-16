import { useEffect, useRef, useState } from "react";

import {
  daysInMonth,
  fromJdn,
  MONTH_NAMES_FA,
  toJdn,
  WEEKDAY_NAMES_FA,
} from "@dotlife/calendar-core";
import {
  addDays,
  dateToJdn,
  jdnToDate,
  localNow,
  minutesToTime,
  softDelete,
  timeToMinutes,
  type LocalDate,
  type Occurrence,
  type Task,
  type TaskReminder,
  type TaskSchedule,
} from "@dotlife/tasks";

import { useRecordsVersion } from "../hooks";
import {
  addFolder,
  createTask,
  liveLists,
  liveNotes,
  newId,
  newNote,
  putTasks,
  taskById,
  TIME_ZONE,
  today,
} from "../noghte/model";
import { notePreview, noteTitle } from "../noghte/notes";
import {
  applyChange,
  applyDelete,
  type OccurrenceChange,
  type Scope,
} from "../noghte/planner/edits";
import { matchPreset, repeatPresets } from "../noghte/planner/repeat";
import {
  connectGoogle,
  createMeetLink,
  deleteEvent,
  googleChanged,
  insertEvent,
  meetIn,
  patchEvent,
  useGoogle,
  useGoogleCalendars,
  withMeet,
  withoutMeet,
  type EventFields,
  type GEvent,
} from "../google";
import { fa } from "../ui/fa";
import { Icon } from "../ui/Icon";

/**
 * The task form, as the app's `TaskSheet` (apps/mobile/src/tasks/TaskSheet.tsx) — the same fields in
 * the same order and words: title → list → schedule (none / deadline / range) → date, all day, times
 * → repeat → reminder → notes → the task's notes → delete. In the middle of the page instead of a
 * bottom sheet; the pickers open under the form, as on the phone. A change to one occurrence of a
 * repeating task asks «فقط همین / این و بعدی‌ها / همه» and lands through the app's own rules
 * (`noghte/planner/edits.ts`). Closing saves, as the app does.
 */

export type EditorInput =
  | { mode: "new"; listId?: string | null; date?: LocalDate; start?: number; end?: number }
  | { mode: "edit"; task: Task; occurrence: Occurrence | null }
  /** One of the person's Google Calendar events, edited in place. */
  | { mode: "event"; event: GEvent };

// ---- one editor for the whole page: any part of it can open the form ----

let current: EditorInput | null = null;
const listeners = new Set<() => void>();
export function openEditor(input: EditorInput): void {
  current = input;
  for (const l of listeners) l();
}
function closeEditor(): void {
  current = null;
  for (const l of listeners) l();
}

export function TaskEditorHost() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = (): void => {
      setTick((t) => t + 1);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (current === null) return null;
  const key =
    current.mode === "edit"
      ? `${current.task.id}-${current.occurrence?.originalDate ?? ""}`
      : current.mode === "event"
        ? `event-${current.event.key}`
        : `new-${current.date ?? ""}-${String(current.start ?? "")}`;
  return <Sheet key={key} input={current} onClose={closeEditor} />;
}

// ---- the form ----

const REMINDERS: readonly { id: string; label: string; offset: number | null }[] = [
  { id: "none", label: "بدون یادآوری", offset: null },
  { id: "at", label: "سر وقت", offset: 0 },
  { id: "m10", label: "۱۰ دقیقه قبل", offset: -10 },
  { id: "m30", label: "۳۰ دقیقه قبل", offset: -30 },
  { id: "h1", label: "۱ ساعت قبل", offset: -60 },
  { id: "d1", label: "۱ روز قبل", offset: -1440 },
];

type Kind = TaskSchedule["kind"];
type Panel = "date" | "endDate" | "start" | "end" | "repeat" | "reminder" | null;
const KINDS: { kind: Kind; label: string }[] = [
  { kind: "none", label: "بدون تاریخ" },
  { kind: "due", label: "مهلت" },
  { kind: "range", label: "بازه" },
];

type Fields = {
  title: string;
  notes: string;
  listId: string | null;
  kind: Kind;
  date: LocalDate;
  endOffset: number;
  allDay: boolean;
  start: number;
  end: number;
  repeatId: string;
  reminderId: string;
  /** Set when the item is (or will be) an event in one of the person's Google calendars. */
  calendarId: string | null;
  /** A Google Meet link for the meeting, or "" (kept in the notes as Google's conferencing block). */
  meet: string;
};

const clock = (m: number): string => fa(minutesToTime(Math.min(Math.max(m, 0), 1439)));
const solarOf = (d: LocalDate) => fromJdn(dateToJdn(d), "solar-hijri");
/** «پنجشنبه ۱۶ مهر ۱۴۰۵» */
function longDate(d: LocalDate): string {
  const s = solarOf(d);
  const wd = WEEKDAY_NAMES_FA[(dateToJdn(d) + 2) % 7] ?? "";
  return fa(
    `${wd} ${String(s.day)} ${MONTH_NAMES_FA["solar-hijri"][s.month - 1] ?? ""} ${String(s.year)}`,
  );
}

function reminderIdOf(reminders: readonly TaskReminder[]): string {
  const r = reminders[0];
  if (r === undefined) return "none";
  if (r.anchor === "absolute" || r.anchor === "end") return "custom";
  return REMINDERS.find((p) => p.offset === r.offsetMinutes)?.id ?? "custom";
}

function remindersOf(f: Fields, previous: readonly TaskReminder[]): TaskReminder[] {
  if (f.kind === "none") return [];
  if (f.reminderId === "custom") return [...previous];
  const preset = REMINDERS.find((p) => p.id === f.reminderId);
  if (preset === undefined || preset.offset === null) return [];
  return [{ anchor: f.kind === "due" ? "due" : "start", offsetMinutes: preset.offset }];
}

/** A Google event's span on Tehran's clock. */
function spanOfEvent(e: GEvent): Pick<Fields, "date" | "endOffset" | "allDay" | "start" | "end"> {
  if (e.allDay) {
    const last = addDays(e.end, -1);
    return {
      date: e.start,
      endOffset: Math.max(0, dateToJdn(last) - dateToJdn(e.start)),
      allDay: true,
      start: 9 * 60,
      end: 10 * 60,
    };
  }
  const a = localNowAt(e.start);
  const b = localNowAt(e.end);
  return {
    date: a.date,
    endOffset: Math.max(0, dateToJdn(b.date) - dateToJdn(a.date)),
    allDay: false,
    start: timeToMinutes(a.time),
    end: timeToMinutes(b.time),
  };
}
const localNowAt = (iso: string) => localNow(TIME_ZONE, new Date(iso));

/** The form's span as Google wants it: instants on Tehran's clock, or whole days (end exclusive). */
function eventFieldsOf(f: Fields, description: string): EventFields {
  const endDate = addDays(f.date, f.endOffset);
  if (f.allDay)
    return {
      title: f.title.trim(),
      description,
      start: f.date,
      end: addDays(endDate, 1),
      allDay: true,
      timeZone: TIME_ZONE,
    };
  const at = (d: LocalDate, m: number): string =>
    `${d}T${minutesToTime(Math.min(m, 1439))}:00+03:30`;
  return {
    title: f.title.trim(),
    description,
    start: at(f.date, f.start),
    end: at(endDate, f.end),
    allDay: false,
    timeZone: TIME_ZONE,
  };
}

function initial(input: EditorInput, todayD: LocalDate): Fields {
  if (input.mode === "event") {
    const e = input.event;
    return {
      title: e.title === "(بدون عنوان)" ? "" : e.title,
      // Google's conferencing block is not the person's text: it stays out of the box
      notes: withoutMeet(e.description),
      listId: null,
      kind: "range",
      ...spanOfEvent(e),
      repeatId: "none",
      reminderId: "none",
      calendarId: e.calendarId,
      meet: e.meet,
    };
  }
  if (input.mode === "new") {
    const timed = input.start !== undefined;
    return {
      title: "",
      notes: "",
      listId: input.listId ?? null,
      kind: timed ? "range" : input.date === undefined ? "none" : "due",
      date: input.date ?? todayD,
      endOffset: 0,
      allDay: !timed,
      start: input.start ?? 9 * 60,
      end: input.end ?? (input.start ?? 9 * 60) + 60,
      repeatId: "none",
      reminderId: "none",
      calendarId: null,
      meet: "",
    };
  }
  const { task, occurrence } = input;
  const s = occurrence?.schedule ?? task.schedule;
  const startPoint = s.kind === "none" ? undefined : s.kind === "range" ? s.start : s.due;
  const endPoint = s.kind === "range" ? s.end : undefined;
  const date = startPoint?.date ?? todayD;
  const start = startPoint?.time === undefined ? 9 * 60 : timeToMinutes(startPoint.time);
  const end = endPoint?.time === undefined ? start + 60 : timeToMinutes(endPoint.time);
  return {
    title: occurrence?.title ?? task.title,
    notes: withoutMeet(task.notes ?? ""),
    listId: task.listId,
    kind: s.kind,
    date,
    endOffset: endPoint === undefined ? 0 : dateToJdn(endPoint.date) - dateToJdn(date),
    allDay: startPoint === undefined || startPoint.time === undefined,
    start,
    end,
    repeatId: s.kind === "none" ? "none" : matchPreset(date, task.recurrence).id,
    reminderId: reminderIdOf(task.reminders),
    calendarId: null,
    meet: meetIn(task.notes ?? ""),
  };
}

function scheduleOf(f: Fields): TaskSchedule {
  if (f.kind === "none") return { kind: "none" };
  if (f.kind === "due") {
    return {
      kind: "due",
      due: f.allDay ? { date: f.date } : { date: f.date, time: minutesToTime(f.start) },
    };
  }
  const endDate = addDays(f.date, f.endOffset);
  if (f.allDay) return { kind: "range", start: { date: f.date }, end: { date: endDate } };
  return {
    kind: "range",
    start: { date: f.date, time: minutesToTime(f.start) },
    end: { date: endDate, time: minutesToTime(Math.min(f.end, 1439)) },
  };
}

function Sheet({ input, onClose }: { input: EditorInput; onClose: () => void }) {
  useRecordsVersion();
  const todayD = today();
  const [start0] = useState<Fields>(() => initial(input, todayD));
  const [f, setF] = useState<Fields>(start0);
  const [panel, setPanel] = useState<Panel>(null);
  const [naming, setNaming] = useState(false);
  const [ask, setAsk] = useState<{
    title: string;
    allowThis: boolean;
    danger: boolean;
    done: (s: Scope | null) => void;
  } | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const update = (patch: Partial<Fields>): void => {
    setF((prev) => ({ ...prev, ...patch }));
  };

  // «خرید» first, as in every list picker of the app
  const lists = liveLists();
  const shownLists = [
    ...lists.filter((l) => l.kind === "shopping"),
    ...lists.filter((l) => l.kind !== "shopping"),
  ];
  const defaultListId = shownLists.find((l) => l.isDefault)?.id ?? shownLists[0]?.id;
  const original = input.mode === "edit" ? input.task : undefined;
  const occurrence = input.mode === "edit" ? input.occurrence : null;
  const event = input.mode === "event" ? input.event : undefined;
  const isEvent = f.calendarId !== null;
  const google = useGoogle();
  const gcals = useGoogleCalendars();
  // a new item may go into a list or a Google calendar; an existing one stays what it is
  const destCalendars =
    event !== undefined
      ? gcals.filter((c) => c.id === event.calendarId)
      : input.mode === "new"
        ? gcals.filter((c) => c.writable)
        : [];
  const [meetBusy, setMeetBusy] = useState(false);
  const [gError, setGError] = useState("");
  const inShopping =
    !isEvent && lists.find((l) => l.id === (f.listId ?? defaultListId))?.kind === "shopping";

  const titled = f.title.trim().length > 0;
  const linked = original === undefined ? [] : liveNotes().filter((n) => n.taskId === original.id);

  const presets = repeatPresets(f.date);
  const preset = presets.find((p) => p.id === f.repeatId);
  const repeatLabel =
    f.repeatId === "custom"
      ? "تکرار سفارشی"
      : preset === undefined || f.repeatId === "none"
        ? "تکرار"
        : fa(`${preset.label} · ${preset.hint ?? ""}`);
  const reminderLabel =
    f.reminderId === "custom"
      ? "یادآوری سفارشی"
      : (REMINDERS.find((r) => r.id === f.reminderId)?.label ?? "یادآوری");

  /** «فقط همین / این و بعدی‌ها / همه» for a repeating task; null when backed out. */
  const askScope = (
    title: string,
    opts: { allowThis?: boolean; danger?: boolean },
  ): Promise<Scope | null> =>
    new Promise((done) => {
      setAsk({ title, allowThis: opts.allowThis ?? true, danger: opts.danger ?? false, done });
    });

  const saved = useRef(false);
  /** Stores the form, as the app's `saveOnce`; false when the scope question was backed out of. */
  const save = async (): Promise<boolean> => {
    if (!titled || saved.current) return true;
    if (f.calendarId !== null) {
      const fields = eventFieldsOf(f, withMeet(f.notes, f.meet));
      saved.current = true;
      try {
        if (event === undefined) await insertEvent(f.calendarId, fields, false);
        else await patchEvent(event, fields, null);
        googleChanged();
      } catch {
        saved.current = false;
        setGError("در تقویم گوگل ذخیره نشد. اتصال را بررسی کن و دوباره امتحان کن.");
        return false;
      }
      return true;
    }
    const title = f.title.trim();
    const notes = withMeet(f.notes, f.meet).trim();
    const notesChanged = f.notes.trim() !== start0.notes.trim() || f.meet !== start0.meet;
    const schedule = scheduleOf(f);
    const recurrence =
      schedule.kind === "none"
        ? undefined
        : f.repeatId === "custom"
          ? original?.recurrence
          : preset?.recurrence;
    const reminders = remindersOf(f, original?.reminders ?? []);
    const listId = f.listId ?? defaultListId;

    if (original === undefined) {
      saved.current = true;
      createTask({
        title,
        schedule,
        reminders,
        ...(listId === undefined ? {} : { listId }),
        ...(recurrence === undefined ? {} : { recurrence }),
        ...(notes === "" ? {} : { notes }),
      });
      return true;
    }
    const fresh = taskById(original.id) ?? original;
    // an undated task, or one made undated: nothing occurrence-scoped to ask about
    if (occurrence === null || schedule.kind === "none") {
      const { recurrence: _r, overrides: _o, notes: _n, ...rest } = fresh;
      saved.current = true;
      putTasks([
        {
          ...rest,
          title,
          schedule,
          reminders,
          updatedAt: new Date().toISOString(),
          ...(listId === undefined ? {} : { listId }),
          ...(recurrence === undefined ? {} : { recurrence }),
          ...(notes === "" ? {} : { notes }),
        },
      ]);
      return true;
    }
    const change: OccurrenceChange = {};
    if (JSON.stringify(schedule) !== JSON.stringify(occurrence.schedule))
      change.schedule = schedule;
    if (title !== start0.title) change.title = title;
    if (notesChanged) change.notes = notes === "" ? null : notes;
    const repeatChanged = f.repeatId !== start0.repeatId;
    if (repeatChanged) change.recurrence = recurrence ?? null;
    const wholeChanged = f.listId !== start0.listId || f.reminderId !== start0.reminderId;
    if (Object.keys(change).length > 0) {
      if (wholeChanged) {
        change.reminders = reminders;
        if (listId !== undefined) change.listId = listId;
      }
      let scope: Scope = "all";
      if (fresh.recurrence !== undefined) {
        const answer = await askScope("تغییر کار تکراری", {
          allowThis: !repeatChanged && change.notes === undefined,
        });
        if (answer === null) return false;
        scope = answer;
      }
      saved.current = true;
      putTasks(applyChange(fresh, occurrence, change, scope, new Date().toISOString(), newId));
    } else if (wholeChanged) {
      saved.current = true;
      putTasks([
        {
          ...fresh,
          ...(listId === undefined ? {} : { listId }),
          reminders,
          updatedAt: new Date().toISOString(),
        },
      ]);
    }
    return true;
  };

  const close = (): void => {
    void save().then((ok) => {
      if (ok) onClose();
    });
  };
  const remove = async (): Promise<void> => {
    if (event !== undefined) {
      try {
        await deleteEvent(event);
        googleChanged();
        saved.current = true;
        onClose();
      } catch {
        setGError("از تقویم گوگل حذف نشد. دوباره امتحان کن.");
      }
      return;
    }
    if (original === undefined) return;
    const fresh = taskById(original.id) ?? original;
    const now = new Date().toISOString();
    if (occurrence === null) {
      putTasks([softDelete(fresh, now)]);
    } else {
      let scope: Scope = "all";
      if (fresh.recurrence !== undefined) {
        const answer = await askScope("حذف کار تکراری", { danger: true });
        if (answer === null) return;
        scope = answer;
      }
      putTasks(applyDelete(fresh, occurrence, scope, now));
    }
    saved.current = true;
    onClose();
  };
  const openNote = (noteId: string | null): void => {
    if (original === undefined) return;
    void save().then((ok) => {
      if (!ok) return;
      if (noteId === null) newNote(f.listId ?? original.listId, { taskId: original.id });
      onClose();
      document.getElementById("s-notes")?.scrollIntoView({ behavior: "smooth" });
    });
  };

  useEffect(() => {
    if (input.mode === "new") titleRef.current?.focus();
  }, [input.mode]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== "Escape" || ask !== null) return;
      if (panel !== null) setPanel(null);
      else close();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  });

  const setStart = (start: number): void => {
    const duration = Math.max(f.end - f.start, 15);
    update({ start, end: Math.min(1439, start + duration) });
  };
  const setEnd = (end: number): void => {
    update({ end: f.endOffset === 0 && end <= f.start ? f.start + 15 : end });
  };
  const choose = (p: Panel): void => {
    setPanel(panel === p ? null : p);
  };

  const addMeet = async (): Promise<void> => {
    setGError("");
    if (google.status !== "on" && !(await connectGoogle())) return;
    setMeetBusy(true);
    try {
      update({ meet: await createMeetLink() });
    } catch {
      setGError("لینک گوگل میت ساخته نشد. دوباره امتحان کن.");
    } finally {
      setMeetBusy(false);
    }
  };

  const label =
    event !== undefined
      ? event.recurring
        ? "رویداد تکراری"
        : "رویداد"
      : isEvent
        ? "رویداد جدید"
        : original === undefined
          ? "کار جدید"
          : original.recurrence === undefined
            ? "کار"
            : "کار تکراری";

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal tsheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="ts-head">
          <span>{label}</span>
          {titled ? (
            <button type="button" className="ts-done" onClick={close}>
              انجام شد
            </button>
          ) : (
            <button type="button" className="ts-done plain" onClick={onClose}>
              بستن
            </button>
          )}
        </div>

        <div className="ts-scroll">
          <textarea
            ref={titleRef}
            className="ts-title"
            rows={1}
            value={f.title}
            placeholder={isEvent ? "عنوان رویداد" : "عنوان کار"}
            onChange={(e) => {
              update({ title: e.target.value.replace(/\n/g, " ") });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />

          <div className="ts-chips">
            {(event === undefined ? shownLists : []).map((l) => {
              const on = !isEvent && (f.listId ?? defaultListId) === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    // no ranges on «خرید»: one becomes a time on its start
                    const toDue = l.kind === "shopping" && f.kind === "range";
                    update({ listId: l.id, calendarId: null, ...(toDue ? { kind: "due" } : {}) });
                    if (toDue && panel === "endDate") setPanel(null);
                  }}
                >
                  <i style={{ background: l.color }} />
                  {l.name}
                </button>
              );
            })}
            {event === undefined && naming ? (
              <input
                className="ts-newlist"
                autoFocus
                placeholder="اسم لیست…"
                onKeyDown={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (e.key === "Enter" && v !== "") {
                    const l = addFolder(v, "#8C9EFF");
                    update({ listId: l.id });
                    setNaming(false);
                  } else if (e.key === "Escape") {
                    e.stopPropagation();
                    setNaming(false);
                  }
                }}
                onBlur={() => {
                  setNaming(false);
                }}
              />
            ) : event === undefined ? (
              <button
                type="button"
                className="add"
                onClick={() => {
                  setNaming(true);
                }}
              >
                <Icon name="plus" />
                لیست
              </button>
            ) : null}
            {/* the person's Google calendars: a new item can go there as an event */}
            {destCalendars.map((c) => {
              const on = f.calendarId === c.id;
              return (
                <button
                  key={`cal-${c.id}`}
                  type="button"
                  aria-pressed={on}
                  title={c.name}
                  onClick={() => {
                    if (event !== undefined) return;
                    update({ calendarId: c.id, kind: "range" });
                    if (panel === "repeat" || panel === "reminder") setPanel(null);
                  }}
                >
                  <Icon name="calendar-face" />
                  {c.name}
                </button>
              );
            })}
            {input.mode === "new" && google.status !== "on" && google.status !== "unavailable" && (
              <button
                type="button"
                className="add"
                onClick={() => {
                  void connectGoogle();
                }}
              >
                <Icon name="calendar-face" />
                تقویم گوگل
              </button>
            )}
          </div>
          <div className="ts-div" />

          <div className="ts-seg" role="radiogroup" aria-label="زمان" hidden={isEvent}>
            {(inShopping ? KINDS.filter((k) => k.kind !== "range") : KINDS).map((k) => (
              <button
                key={k.kind}
                type="button"
                role="radio"
                aria-checked={f.kind === k.kind}
                onClick={() => {
                  update({
                    kind: k.kind,
                    allDay: k.kind === "range" ? f.allDay && start0.kind === "range" : f.allDay,
                  });
                  setPanel(null);
                }}
              >
                {k.label}
              </button>
            ))}
          </div>

          {f.kind !== "none" && (
            <>
              <button
                type="button"
                className={panel === "date" ? "ts-line on" : "ts-line"}
                onClick={() => {
                  choose("date");
                }}
              >
                <Icon name="calendar-face" />
                <span>{f.kind === "range" ? `از ${longDate(f.date)}` : longDate(f.date)}</span>
              </button>
              {f.kind === "range" && (
                <button
                  type="button"
                  className={panel === "endDate" ? "ts-line in on" : "ts-line in"}
                  onClick={() => {
                    choose("endDate");
                  }}
                >
                  <span>تا {longDate(addDays(f.date, f.endOffset))}</span>
                </button>
              )}
              <label className="ts-line">
                <Icon name="time-circle" />
                <span className="grow">تمام‌روز</span>
                <input
                  type="checkbox"
                  className="switch"
                  checked={f.allDay}
                  onChange={(e) => {
                    update({ allDay: e.target.checked });
                    if (e.target.checked) setPanel(null);
                  }}
                />
              </label>
              {!f.allDay && (
                <div className="ts-line in">
                  <button
                    type="button"
                    className={panel === "start" ? "ts-time on" : "ts-time"}
                    onClick={() => {
                      choose("start");
                    }}
                  >
                    {clock(f.start)}
                  </button>
                  {f.kind === "range" && (
                    <>
                      <Icon name="arrow-left" />
                      <button
                        type="button"
                        className={panel === "end" ? "ts-time on" : "ts-time"}
                        onClick={() => {
                          choose("end");
                        }}
                      >
                        {clock(f.end)}
                      </button>
                    </>
                  )}
                </div>
              )}
              {!isEvent && (
                <>
                  <button
                    type="button"
                    className={[
                      "ts-line",
                      panel === "repeat" ? "on" : "",
                      f.repeatId === "none" ? "dim" : "",
                    ].join(" ")}
                    onClick={() => {
                      choose("repeat");
                    }}
                  >
                    <Icon name="refresh" />
                    <span>{repeatLabel}</span>
                  </button>
                  <button
                    type="button"
                    className={[
                      "ts-line",
                      panel === "reminder" ? "on" : "",
                      f.reminderId === "none" ? "dim" : "",
                    ].join(" ")}
                    onClick={() => {
                      choose("reminder");
                    }}
                  >
                    <Icon name="notification" />
                    <span>{reminderLabel}</span>
                  </button>
                </>
              )}
            </>
          )}
          {f.kind !== "none" && google.status !== "unavailable" && (
            <div className="ts-line meet">
              <Icon name="video" />
              {f.meet === "" ? (
                <button
                  type="button"
                  className="ts-link dim"
                  disabled={meetBusy}
                  onClick={() => void addMeet()}
                >
                  {meetBusy ? "در حال ساختن لینک گوگل میت…" : "افزودن گوگل میت"}
                </button>
              ) : (
                <>
                  <a className="ts-link" href={f.meet} target="_blank" rel="noreferrer">
                    گوگل میت · {f.meet.replace(/^https?:\/\//, "")}
                  </a>
                  <button
                    type="button"
                    className="ts-x"
                    aria-label="برداشتن گوگل میت"
                    onClick={() => {
                      update({ meet: "" });
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </>
              )}
            </div>
          )}
          {gError !== "" && <p className="ts-err">{gError}</p>}
          <div className="ts-div" />

          <div className="ts-line top">
            <Icon name="edit" />
            <textarea
              className="ts-notes"
              value={f.notes}
              placeholder={isEvent ? "توضیحات" : "یادداشت"}
              onChange={(e) => {
                update({ notes: e.target.value });
              }}
            />
          </div>

          {event !== undefined && (
            <>
              <div className="ts-div" />
              <button type="button" className="ts-line danger" onClick={() => void remove()}>
                <Icon name="delete" />
                <span>{event.recurring ? "حذف رویداد تکراری" : "حذف رویداد"}</span>
              </button>
            </>
          )}
          {original !== undefined && (
            <>
              {linked.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className="ts-line note"
                  onClick={() => {
                    openNote(n.id);
                  }}
                >
                  <Icon name="sticker-note" />
                  <span className="grow">
                    <b>{noteTitle(n)}</b>
                    {notePreview(n) !== "" && <small>{notePreview(n)}</small>}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="ts-line dim"
                onClick={() => {
                  openNote(null);
                }}
              >
                <Icon name="sticker-note" />
                <span>
                  {linked.length === 0 ? "نوشتن یادداشت برای این کار" : "یادداشت دیگر برای این کار"}
                </span>
              </button>
              <div className="ts-div" />
              <button type="button" className="ts-line danger" onClick={() => void remove()}>
                <Icon name="delete" />
                <span>{original.recurrence === undefined ? "حذف کار" : "حذف کار تکراری"}</span>
              </button>
            </>
          )}
        </div>

        {panel !== null && (
          <div className="ts-panel">
            {(panel === "start" || panel === "end") && (
              <TimePicker
                minutes={panel === "start" ? f.start : Math.min(f.end, 1435)}
                onChange={panel === "start" ? setStart : setEnd}
              />
            )}
            {(panel === "date" || panel === "endDate") && (
              <DatePicker
                marked={panel === "date" ? f.date : addDays(f.date, f.endOffset)}
                todayD={todayD}
                onPick={(date) => {
                  if (panel === "date") update({ date });
                  else update({ endOffset: Math.max(0, dateToJdn(date) - dateToJdn(f.date)) });
                }}
              />
            )}
            {panel === "repeat" &&
              presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={p.id === f.repeatId ? "ts-opt on" : "ts-opt"}
                  onClick={() => {
                    update({ repeatId: p.id });
                    setPanel(null);
                  }}
                >
                  {fa(p.label)} {p.hint !== undefined && <small>{fa(p.hint)}</small>}
                </button>
              ))}
            {panel === "reminder" &&
              REMINDERS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={r.id === f.reminderId ? "ts-opt on" : "ts-opt"}
                  onClick={() => {
                    update({ reminderId: r.id });
                    setPanel(null);
                  }}
                >
                  {r.label}
                </button>
              ))}
            {panel !== "repeat" && panel !== "reminder" && (
              <button
                type="button"
                className="ts-confirm"
                onClick={() => {
                  setPanel(null);
                }}
              >
                تأیید
              </button>
            )}
          </div>
        )}

        {ask !== null && (
          <div className="ts-ask" role="alertdialog" aria-label={ask.title}>
            <b>{ask.title}</b>
            {(
              [
                ["this", "فقط همین"],
                ["following", "این و بعدی‌ها"],
                ["all", "همه"],
              ] as const
            )
              .filter(([s]) => s !== "this" || ask.allowThis)
              .map(([s, l]) => (
                <button
                  key={s}
                  type="button"
                  className={ask.danger ? "danger" : ""}
                  onClick={() => {
                    ask.done(s);
                    setAsk(null);
                  }}
                >
                  {l}
                </button>
              ))}
            <button
              type="button"
              className="cancel"
              onClick={() => {
                ask.done(null);
                setAsk(null);
              }}
            >
              انصراف
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Hours and minutes side by side, as the app's wheel: tap a value (five-minute steps). */
function TimePicker({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = useRef<HTMLDivElement>(null);
  const mins = useRef<HTMLDivElement>(null);
  useEffect(() => {
    hours.current?.querySelector(".on")?.scrollIntoView({ block: "center" });
    mins.current?.querySelector(".on")?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div className="ts-tp" dir="ltr">
      <div ref={hours} className="col">
        {Array.from({ length: 24 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={i === h ? "on" : ""}
            onClick={() => {
              onChange(i * 60 + m);
            }}
          >
            {fa(String(i).padStart(2, "0"))}
          </button>
        ))}
      </div>
      <span>:</span>
      <div ref={mins} className="col">
        {Array.from({ length: 12 }, (_, i) => i * 5).map((v) => (
          <button
            key={v}
            type="button"
            className={v === m - (m % 5) ? "on" : ""}
            onClick={() => {
              onChange(h * 60 + v);
            }}
          >
            {fa(String(v).padStart(2, "0"))}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A Solar month to pick a day in, as the app's `MiniMonth` with its title. */
function DatePicker({
  marked,
  todayD,
  onPick,
}: {
  marked: LocalDate;
  todayD: LocalDate;
  onPick: (d: LocalDate) => void;
}) {
  const s0 = solarOf(marked);
  const [shown, setShown] = useState({ year: s0.year, month: s0.month });
  const firstJ = toJdn({ calendar: "solar-hijri", year: shown.year, month: shown.month, day: 1 });
  const n = daysInMonth("solar-hijri", shown.year, shown.month);
  const move = (delta: number): void => {
    setShown((m) => {
      const i = m.year * 12 + m.month - 1 + delta;
      return { year: Math.floor(i / 12), month: (i % 12) + 1 };
    });
  };
  return (
    <div className="ts-dp">
      <div className="h">
        <b>
          {MONTH_NAMES_FA["solar-hijri"][shown.month - 1]} {fa(String(shown.year))}
        </b>
        <button
          type="button"
          aria-label="ماه قبل"
          onClick={() => {
            move(-1);
          }}
        >
          <Icon name="arrow-left" className="flip" />
        </button>
        <button
          type="button"
          aria-label="ماه بعد"
          onClick={() => {
            move(1);
          }}
        >
          <Icon name="arrow-left" />
        </button>
      </div>
      <div className="g">
        {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((w) => (
          <span key={w} className="wk">
            {w}
          </span>
        ))}
        {Array.from({ length: (firstJ + 2) % 7 }, (_, i) => (
          <span key={`p${String(i)}`} />
        ))}
        {Array.from({ length: n }, (_, i) => {
          const d = jdnToDate(firstJ + i);
          return (
            <button
              key={d}
              type="button"
              className={[
                d === marked ? "on" : "",
                d === todayD ? "tdy" : "",
                (firstJ + i + 2) % 7 === 6 ? "fri" : "",
              ].join(" ")}
              onClick={() => {
                onPick(d);
              }}
            >
              {fa(String(i + 1))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
