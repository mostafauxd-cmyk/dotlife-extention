import { addMinutes } from "./dates";
import type { LocalDateTime, Occurrence, TaskReminder } from "./models";

/**
 * When to fire reminders for an occurrence, as local date-times in the task's zone. The app layer turns
 * these into local notifications (never server push — PLAN §0). All-day anchors fire at `allDayTime`.
 */
export function reminderTimes(
  occurrence: Occurrence,
  reminders: readonly TaskReminder[],
  allDayTime = "09:00",
): LocalDateTime[] {
  const s = occurrence.schedule;
  const out: LocalDateTime[] = [];
  for (const r of reminders) {
    switch (r.anchor) {
      case "absolute": {
        const [date, time] = r.at.split("T") as [string, string | undefined];
        out.push({ date, time: (time ?? allDayTime).slice(0, 5) });
        break;
      }
      case "due": {
        if (s.kind !== "due") break;
        out.push(addMinutes({ date: s.due.date, time: s.due.time ?? allDayTime }, r.offsetMinutes));
        break;
      }
      case "start": {
        if (s.kind !== "range") break;
        out.push(
          addMinutes({ date: s.start.date, time: s.start.time ?? allDayTime }, r.offsetMinutes),
        );
        break;
      }
      case "end": {
        if (s.kind !== "range") break;
        out.push(addMinutes({ date: s.end.date, time: s.end.time ?? allDayTime }, r.offsetMinutes));
        break;
      }
    }
  }
  return out.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}
