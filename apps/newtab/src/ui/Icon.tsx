import { ICONS, type IconName } from "./icons";

/** One Iconly glyph, in the current text colour. Its markup comes only from icons.ts. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <span
      className={className === undefined ? "ico" : `ico ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

/** The plain single-stroke G beside the search text: searches go to Google. */
export function GMark() {
  return (
    <svg className="gline" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 12h-7" />
    </svg>
  );
}
