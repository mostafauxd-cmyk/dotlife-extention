import type { ReactNode } from "react";

/**
 * The page's one tab bar: a soft glass pill, the chosen item a translucent white on it (the pill
 * glides between items, see `morph.ts`). Every row of choices that reads as tabs — the plans' view,
 * the days shown, the services, the market's groups and periods — is this, in three sizes:
 * `md` (a main bar), `sm` (a bar inside a card) and `block` (a card's tabs sharing its full width).
 */

export type TabItem<T extends string | number> = {
  id: T;
  label: ReactNode;
  /** Before the label (a service's mark). */
  icon?: ReactNode;
  /** After the label, in a small bubble (how many are open). */
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
          {t.icon}
          {t.label}
          {t.count !== undefined && <span className="n">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
