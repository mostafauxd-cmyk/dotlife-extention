import { useEffect, useState } from "react";

import type { TaskList } from "@dotlife/tasks";

import { availableListColors, LIST_COLORS } from "../listColors";
import { addFolder, liveLists } from "../noghte/model";
import { Icon } from "../ui/Icon";

/**
 * «دسته‌ی تازه»: a title and a colour. A category is the app's list — the same record the notes'
 * folders, the tasks' lists and the plans' calendars are, and the phone's — so one made here is
 * there at the next sync, and it can be made from any of those places with this one sheet.
 */

type Ask = { onCreated?: (list: TaskList) => void };
let current: Ask | null = null;
const listeners = new Set<() => void>();
const tell = (): void => {
  for (const l of listeners) l();
};

/** Opens the sheet; `onCreated` hears the new list (to choose it, to show it). */
export function openNewCategory(onCreated?: (list: TaskList) => void): void {
  current = onCreated === undefined ? {} : { onCreated };
  tell();
}

export function NewCategoryHost() {
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
  return (
    <Sheet
      ask={current}
      onClose={() => {
        current = null;
        tell();
      }}
    />
  );
}

function Sheet({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const [name, setName] = useState("");
  // one sideways line, like the app's list sheet: the free colours in wheel order, then the ones
  // other lists use, faded and disabled
  const [taken] = useState(() => liveLists().map((l) => l.color.toLowerCase()));
  const free = availableListColors(taken);
  const palette = [...free, ...LIST_COLORS.filter((c) => taken.includes(c.toLowerCase()))].filter(
    (c, i, all) => all.indexOf(c) === i,
  );
  const [color, setColor] = useState<string>(free[0] ?? LIST_COLORS[0] ?? "#6FB6F2");
  const ok = name.trim() !== "";
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    addEventListener("keydown", onKey, true);
    return () => {
      removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);
  const make = (): void => {
    if (!ok) return;
    const l = addFolder(name, color);
    ask.onCreated?.(l);
    onClose();
  };
  return (
    <div
      className="modal-bg cat-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        className="modal cat"
        role="dialog"
        aria-modal="true"
        aria-label="دسته‌ی تازه"
        onSubmit={(e) => {
          e.preventDefault();
          make();
        }}
      >
        <div className="card-h">
          <h2>دسته‌ی تازه</h2>
          <button type="button" className="rbtn sm" aria-label="بستن" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <p className="cat-hint">با همین اسم و رنگ روی گوشی هم دیده می‌شود.</p>
        <label className="cat-field">
          <i style={{ background: color }} />
          <input
            autoFocus
            value={name}
            placeholder="اسم دسته…"
            maxLength={40}
            aria-label="اسم دسته"
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
        </label>
        <div className="cat-colors" role="radiogroup" aria-label="رنگ">
          {palette.map((c) => {
            const used = taken.includes(c.toLowerCase());
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={used ? `رنگ ${c}، برای دسته‌ی دیگری است` : `رنگ ${c}`}
                disabled={used}
                className={used ? "used" : undefined}
                style={{ background: c }}
                onClick={() => {
                  setColor(c);
                }}
              />
            );
          })}
        </div>
        <button type="submit" className="cta" disabled={!ok}>
          ساختن
        </button>
      </form>
    </div>
  );
}
