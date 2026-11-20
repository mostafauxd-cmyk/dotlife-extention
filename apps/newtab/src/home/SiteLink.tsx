import { t } from "../i18n";
import { faviconUrl } from "../platform";
import { linkIn, linkLabel } from "../noghte/taskLink";

/** The site icon of the page kept on a task: one click opens the page. Nothing when there is none. */
export function SiteLink({ notes }: { notes: string | undefined }) {
  const url = linkIn(notes ?? "");
  if (url === "") return null;
  return (
    <a
      className="td-site"
      href={url}
      target="_blank"
      rel="noreferrer"
      title={linkLabel(url)}
      aria-label={t("باز کردن {site}", { site: linkLabel(url) })}
    >
      <img src={faviconUrl(url, 32)} alt="" />
    </a>
  );
}
