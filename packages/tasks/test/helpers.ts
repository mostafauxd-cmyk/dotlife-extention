import type { Task, TaskSchedule } from "../src";

export const NOW_ISO = "2026-10-05T08:00:00.000Z";

let seq = 0;
export function task(partial: Partial<Task> & { schedule: TaskSchedule }): Task {
  seq++;
  return {
    id: partial.id ?? `t${String(seq).padStart(3, "0")}`,
    listId: "inbox",
    title: partial.title ?? `task ${String(seq)}`,
    status: "todo",
    priority: "none",
    timeZone: "Asia/Tehran",
    reminders: [],
    order: "V",
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
    ...partial,
  };
}

export const due = (date: string, time?: string): TaskSchedule => ({
  kind: "due",
  due: time === undefined ? { date } : { date, time },
});

export const range = (start: string, end: string, times?: [string, string]): TaskSchedule => ({
  kind: "range",
  start: times ? { date: start, time: times[0] } : { date: start },
  end: times ? { date: end, time: times[1] } : { date: end },
});
