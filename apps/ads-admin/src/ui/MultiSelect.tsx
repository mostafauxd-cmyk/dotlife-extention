import { useId, useState } from "react";

import { normalize } from "../data/labels";
import { Icon } from "./Icon";

/**
 * Pick any number from a fixed list, or none (none means everyone). The chosen ones show as chips;
 * typing filters the list. Only the list's own values can be chosen, so what is saved is exactly
 * what a client sends.
 */
export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  options: readonly string[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = useId();
  const n = normalize(q);
  const left = options.filter((o) => !value.includes(o) && (n === "" || normalize(o).includes(n)));
  const add = (o: string): void => {
    onChange([...value, o]);
    setQ("");
  };
  return (
    <div className="multi">
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
          role="combobox"
          aria-expanded={open}
          aria-controls={list}
          aria-autocomplete="list"
          value={q}
          placeholder={value.length === 0 ? placeholder : undefined}
          onFocus={() => {
            setOpen(true);
          }}
          onBlur={() => {
            // let a click on an option land first
            window.setTimeout(() => {
              setOpen(false);
            }, 150);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const first = left[0];
              if (first !== undefined) add(first);
            } else if (e.key === "Backspace" && q === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && left.length > 0 && (
        <ul className="multi-list" id={list} role="listbox">
          {left.slice(0, 40).map((o) => (
            <li key={o} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  add(o);
                }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
