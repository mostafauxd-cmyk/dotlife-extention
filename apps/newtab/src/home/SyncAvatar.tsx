import { useNow, useSession, useSyncState } from "../hooks";
import { ago } from "../ui/fa";

/**
 * The account, beside the gear, with a small badge that says at a glance whether this page is in
 * step with the phone: green when it is live (breathing while it syncs), grey when it is not —
 * offline, a failed sync, or nobody signed in (then everything stays in this browser).
 */
export function SyncAvatar({ onOpen, onSignIn }: { onOpen: () => void; onSignIn: () => void }) {
  const session = useSession();
  const sync = useSyncState();
  useNow(30_000); // «همگام‌شده ۲ دقیقه پیش» stays true
  const status = session === null ? "signed-out" : sync.status;
  const when = sync.lastAt === null ? "" : ` · ${ago(new Date(sync.lastAt).toISOString())}`;
  const say =
    status === "signed-out"
      ? "وارد نقطه نشده‌ای؛ کارها و یادداشت‌ها فقط روی همین مرورگرند"
      : status === "syncing"
        ? "در حال همگام‌سازی با گوشی…"
        : status === "offline"
          ? "آفلاین؛ وقتی وصل شدی می‌فرستم"
          : status === "error"
            ? "همگام نشد؛ دوباره امتحان می‌کنم"
            : `همگام با گوشی${when}`;
  return (
    <button
      type="button"
      className={`me ${status}`}
      aria-label={say}
      title={say}
      onClick={session === null ? onSignIn : onOpen}
    >
      <span className="me-in">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          >
            <path d="M11.98 15.35c-3.87 0-7.17.58-7.17 2.92s3.28 2.95 7.17 2.95c3.87 0 7.17-.59 7.17-2.93s-3.28-2.94-7.17-2.94z" />
            <path d="M11.98 12.01a4.6 4.6 0 1 0-.03 0h.03z" />
          </g>
        </svg>
      </span>
    </button>
  );
}
