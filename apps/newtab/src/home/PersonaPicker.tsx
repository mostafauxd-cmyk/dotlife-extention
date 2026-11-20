import { useSettings } from "../hooks";
import { t } from "../i18n";
import { PERSONAS, togglePersona } from "../personas";

/**
 * «کدام بیشتر شبیه توست؟»: one button per kind of work, as many picked as the person does; each one
 * picked puts that work's folder of sites in the quick-access row, picking it again takes it away.
 */
export function PersonaPicker() {
  const s = useSettings();
  return (
    <div
      className="personas"
      role="group"
      aria-label={t("کدام بیشتر شبیه توست؟ (چند تا هم می‌شود)")}
    >
      {PERSONAS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="persona"
          aria-pressed={s.personas.includes(p.id)}
          onClick={() => {
            togglePersona(p.id);
          }}
        >
          <b>{t(p.name)}</b>
          <small>{t(p.hint)}</small>
        </button>
      ))}
    </div>
  );
}
