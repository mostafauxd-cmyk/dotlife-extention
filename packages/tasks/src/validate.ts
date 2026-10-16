import { TaskListSchema, TaskSchema, type Task, type TaskList, type TaskSchedule } from "./models";
import { pointKey } from "./dates";

export class TaskValidationError extends Error {
  constructor(
    public readonly code:
      | "schema"
      | "end-before-start"
      | "mixed-all-day"
      | "recurrence-without-schedule"
      | "weekly-needs-weekday"
      | "until-before-start",
    message: string,
  ) {
    super(message);
    this.name = "TaskValidationError";
  }
}

/** Structural + semantic rules from PLAN §15. Throws {@link TaskValidationError}. */
export function validateSchedule(s: TaskSchedule): void {
  if (s.kind !== "range") return;
  const startHasTime = s.start.time !== undefined;
  const endHasTime = s.end.time !== undefined;
  if (startHasTime !== endHasTime) {
    throw new TaskValidationError(
      "mixed-all-day",
      "شروع و پایان باید هر دو ساعت داشته باشند یا هر دو تمام‌روز باشند",
    );
  }
  if (pointKey(s.end) < pointKey(s.start)) {
    throw new TaskValidationError("end-before-start", "پایان نمی‌تواند قبل از شروع باشد");
  }
}

export function validateTask(task: Task): void {
  const parsed = TaskSchema.safeParse(task);
  if (!parsed.success) throw new TaskValidationError("schema", parsed.error.message);
  validateSchedule(task.schedule);
  const r = task.recurrence;
  if (!r) return;
  if (task.schedule.kind === "none") {
    throw new TaskValidationError(
      "recurrence-without-schedule",
      "کار تکراری باید مهلت یا بازه داشته باشد",
    );
  }
  if (r.freq === "weekly" && r.byWeekday !== undefined && r.byWeekday.length === 0) {
    throw new TaskValidationError(
      "weekly-needs-weekday",
      "تکرار هفتگی به حداقل یک روز هفته نیاز دارد",
    );
  }
  if (r.end.kind === "until") {
    const seed = task.schedule.kind === "due" ? task.schedule.due.date : task.schedule.start.date;
    if (r.end.date < seed) {
      throw new TaskValidationError(
        "until-before-start",
        "پایان تکرار نمی‌تواند قبل از اولین نمونه باشد",
      );
    }
  }
}

export function validateList(list: TaskList): void {
  const parsed = TaskListSchema.safeParse(list);
  if (!parsed.success) throw new TaskValidationError("schema", parsed.error.message);
}

export function isValidTask(task: Task): boolean {
  try {
    validateTask(task);
    return true;
  } catch {
    return false;
  }
}
