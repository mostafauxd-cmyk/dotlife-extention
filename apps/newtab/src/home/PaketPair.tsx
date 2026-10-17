import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { usePaketLinked } from "../paket";
import { Icon } from "../ui/Icon";
import { PaketLogo, PaketSync } from "./PaketSync";

/**
 * The sheet that links Paket to this page (the code from the phone, typed here), from wherever the
 * page offers it: the money slide's «دارایی‌های من» and the Paket corner. `openPaketPair` asks for it;
 * `PaketPairHost`, mounted once, shows it.
 */

type Ask = { title?: string; lead?: string };
let current: Ask | null = null;
const listeners = new Set<() => void>();
const tell = (): void => {
  for (const l of listeners) l();
};

export function openPaketPair(ask: Ask = {}): void {
  current = ask;
  tell();
}

export function PaketPairHost() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = (): void => {
      setTick((t) => t + 1);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (current === null) return null;
  return (
    <PaketPairModal
      title={current.title}
      lead={current.lead}
      onClose={() => {
        current = null;
        tell();
      }}
    />
  );
}

/**
 * The sheet itself: the logo and one title, the way to link while Paket is not linked, and, once it
 * is, `linked` (or a plain line and a link to Paket).
 */
export function PaketPairModal({
  title = "پاکت را به نقطه وصل کن",
  lead,
  linked,
  onClose,
}: {
  title?: string | undefined;
  lead?: string | undefined;
  /** What to show when Paket is already linked. */
  linked?: ReactNode;
  onClose: () => void;
}) {
  const isLinked = usePaketLinked();
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return createPortal(
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal wide pf-invite" role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-h">
          <PaketLogo size={40} />
          <h2>{title}</h2>
          <button type="button" className="rbtn sm" aria-label="بستن" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {isLinked ? (
          (linked ?? (
            <div className="pf-body">
              <p>پاکت به این صفحه وصل است.</p>
              <a
                className="cta"
                href="https://paket.life/?src=chrome&c=pair"
                target="_blank"
                rel="noreferrer"
              >
                باز کردن پاکت
              </a>
            </div>
          ))
        ) : (
          <PaketSync embedded {...(lead === undefined ? {} : { lead })} />
        )}
      </div>
    </div>,
    // inside the page's root, where the theme's colours are defined (the body has none)
    document.querySelector(".nt") ?? document.body,
  );
}
