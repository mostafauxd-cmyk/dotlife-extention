import { useState } from "react";

import { useSettings } from "../hooks";
import { CITIES, findCities, flat, POPULAR_CITIES } from "../cities";
import { updateSettings } from "../settings";
import { Icon } from "../ui/Icon";

/**
 * «شهر تو»: type a few letters of the city and pick it from the list (every province's capital and
 * more); any other name can be added as typed. The chosen city shows as one chip that can be taken
 * off. It stays on this device and only aims the «معرفی‌شده» boxes.
 */
export function CityPicker() {
  const s = useSettings();
  const [q, setQ] = useState("");
  const found = findCities(q);
  const exact = CITIES.some((c) => flat(c) === flat(q));
  const pick = (c: string): void => {
    updateSettings({ city: c });
    setQ("");
  };

  if (s.city !== null)
    return (
      <div className="cp-chosen">
        <span className="cp-chip">
          {s.city}
          <button
            type="button"
            aria-label={`برداشتن ${s.city}`}
            onClick={() => {
              updateSettings({ city: null });
            }}
          >
            <Icon name="close" />
          </button>
        </span>
      </div>
    );

  return (
    <div className="cp">
      <label className="cp-field">
        <Icon name="search" />
        <input
          value={q}
          placeholder="شهرت را بنویس…"
          autoComplete="off"
          aria-label="شهر"
          onChange={(e) => {
            setQ(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const first = found[0];
            if (first !== undefined) pick(first);
            else if (q.trim() !== "") pick(q.trim());
          }}
        />
      </label>
      {q.trim() === "" ? (
        <div className="ab-chips" role="group" aria-label="شهرهای پرتکرار">
          {POPULAR_CITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                pick(c);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <ul className="cp-list" role="listbox" aria-label="شهرها">
          {found.map((c) => (
            <li key={c}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  pick(c);
                }}
              >
                {c}
              </button>
            </li>
          ))}
          {!exact && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="cp-own"
                onClick={() => {
                  pick(q.trim());
                }}
              >
                افزودن «{q.trim()}»
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
