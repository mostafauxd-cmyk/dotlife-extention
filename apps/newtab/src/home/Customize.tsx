import { useSession, useSettings, useSyncState } from "../hooks";
import { signOut } from "../noghte/api";
import { syncNow } from "../noghte/sync";
import { BLOCKS, DEFAULTS, isOn, THEMES, toggleBlock, updateSettings } from "../settings";
import { ago, fa } from "../ui/fa";
import { Icon } from "../ui/Icon";

/** «شخصی‌سازی»: the colour, what shows on the first view, and the نقطه account. */
export function Customize({ onClose, onSignIn }: { onClose: () => void; onSignIn: () => void }) {
  const s = useSettings();
  const session = useSession();
  const sync = useSyncState();
  return (
    <aside className="cust" aria-label="شخصی‌سازی">
      <div className="cust-h">
        <h2>شخصی‌سازی</h2>
        <button type="button" className="rbtn" aria-label="بستن" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <h3>حساب نقطه</h3>
      {session === null ? (
        <div className="acct">
          کارها و یادداشت‌ها با اپ نقطه یکی می‌شوند.
          <button type="button" className="ghost" onClick={onSignIn}>
            ورود
          </button>
        </div>
      ) : (
        <div className="acct">
          <span>
            <b>{fa(session.label)}</b>
            <br />
            <small style={{ color: "var(--ink-3)" }}>
              {sync.lastAt === null
                ? "هنوز همگام نشده"
                : `همگام‌شده ${ago(new Date(sync.lastAt).toISOString())}`}
            </small>
          </span>
          <button type="button" className="ghost" onClick={() => void syncNow()}>
            همگام‌سازی
          </button>
          <button type="button" className="ghost" onClick={() => void signOut()}>
            خروج
          </button>
        </div>
      )}

      <h3>صفحه‌ی اول</h3>
      <div className="chint">صفحه‌ی اول فقط نقطه و سرچ است؛ بقیه در گوشه‌ها و لبه منتظرند.</div>
      <div className="tgrid">
        {BLOCKS.map(([id, name]) => (
          <button
            key={id}
            type="button"
            className="trow"
            aria-pressed={isOn(s, id)}
            onClick={() => {
              toggleBlock(id);
            }}
          >
            {name}
            <span className="sw" />
          </button>
        ))}
      </div>

      <h3>رنگ پس‌زمینه</h3>
      <div className="wps">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="wp"
            aria-pressed={s.theme === t.id}
            onClick={() => {
              updateSettings({ theme: t.id });
            }}
          >
            <i
              style={{
                background: `radial-gradient(circle at 50% 50%, ${t.tint} 0 16%, transparent 17%), radial-gradient(circle at 50% 45%, ${t.tint}33, transparent 70%), ${t.bg}`,
              }}
            />
            {t.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            updateSettings({ ...DEFAULTS });
          }}
        >
          چیدمان پیش‌فرض
        </button>
      </div>
    </aside>
  );
}
