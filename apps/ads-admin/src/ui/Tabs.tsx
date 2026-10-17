import type { ReactNode } from "react";

/**
 * The tab bar of the new tab (apps/newtab/src/ui/Tabs.tsx), copied so the panel looks the same: a
 * soft glass pill, the chosen item a translucent white on it (the pill glides, see `morph.ts`).
 * Sizes: `md` (the main bar), `sm` (a bar inside a card), and `block` (tabs sharing the full width).
 */

export type TabItem<T extends string | number> = {
  id: T;
  label: ReactNode;
  /** After the label, in a small bubble (how many there are). */
  count?: ReactNode;
  title?: string;
};

export function Tabs<T extends string | number>({
  items,
  value,
  onChange,
  label,
  size = "md",
  block = false,
}: {
  items: readonly TabItem<T>[];
  value: T | undefined;
  onChange: (id: T) => void;
  /** What the bar chooses, for screen readers. */
  label: string;
  size?: "md" | "sm";
  block?: boolean;
}) {
  const cls = ["tabs", "morph", size === "sm" ? "sm" : "", block ? "block" : ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} role="tablist" aria-label={label}>
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          title={t.title}
          aria-selected={t.id === value}
          onClick={() => {
            onChange(t.id);
          }}
        >
          {t.label}
          {t.count !== undefined && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
