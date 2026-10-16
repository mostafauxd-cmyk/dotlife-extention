import { useSettings } from "../hooks";
import { applyPersona, PERSONAS } from "../personas";

/**
 * «کدام بیشتر شبیه توست؟»: one button per kind of work; picking one puts that work's folder of sites in
 * the quick-access row, picking it again takes the folder away.
 */
export function PersonaPicker() {
  const s = useSettings();
  return (
    <div className="personas" role="group" aria-label="کدام بیشتر شبیه توست؟">
      {PERSONAS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="persona"
          aria-pressed={s.persona === p.id}
          onClick={() => {
            applyPersona(s.persona === p.id ? null : p.id);
          }}
        >
          <b>{p.name}</b>
          <small>{p.hint}</small>
        </button>
      ))}
    </div>
  );
}
