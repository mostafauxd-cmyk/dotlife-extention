import { useId, useState, type ReactNode } from "react";

import { Icon } from "./Icon";

/** The form's building blocks: a labelled field with its hint and error, chips, and a tag input. */

export function Field({
  label,
  hint,
  error,
  children,
  wide = false,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  children: (id: string) => ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className={wide ? "field wide" : "field"}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error !== undefined ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : (
        hint !== undefined && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

/** A set of choices shown as chips, any number of which can be on. */
export function ChipSet<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly { id: T; label: string }[];
  value: readonly T[];
  onChange: (next: T[]) => void;
  label: string;
}) {
  return (
    <div className="chipset" role="group" aria-label={label}>
      {items.map((it) => {
        const on = value.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            className="chip-btn"
            aria-pressed={on}
            onClick={() => {
              onChange(on ? value.filter((v) => v !== it.id) : [...value, it.id]);
            }}
          >
            {on && <Icon name="check" size={14} />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free words as removable chips: Enter or a comma adds one; suggestions come from a datalist. */
export function TagInput({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder,
}: {
  id: string;
  value: readonly string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const list = useId();
  const add = (raw: string): void => {
    const words = raw
      .split(/[,،]/)
      .map((w) => w.trim())
      .filter((w) => w !== "" && !value.includes(w));
    if (words.length > 0) onChange([...value, ...words]);
    setText("");
  };
  return (
    <div className="tags">
      {value.map((w) => (
        <span key={w} className="tag-chip">
          {w}
          <button
            type="button"
            aria-label={`برداشتن ${w}`}
            onClick={() => {
              onChange(value.filter((v) => v !== w));
            }}
          >
            <Icon name="x" size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        list={list}
        placeholder={value.length === 0 ? placeholder : undefined}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,،]$/.test(v)) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
          } else if (e.key === "Backspace" && text === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          add(text);
        }}
      />
      <datalist id={list}>
        {suggestions
          .filter((s) => !value.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
