import { useEffect, type ReactNode } from "react";

/** A modal over the page: dims it, closes on Escape or a click outside. */
export function Dialog({
  title,
  onClose,
  children,
  actions,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={wide ? "dialog wide" : "dialog"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2>{title}</h2>
        <div className="dlg-body">{children}</div>
        {actions !== undefined && <div className="dlg-actions">{actions}</div>}
      </div>
    </div>
  );
}

/** «Delete this?» — a destructive action always asks. */
export function ConfirmDialog({
  title,
  message,
  confirm,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn danger" onClick={onConfirm}>
            {confirm}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            انصراف
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Dialog>
  );
}
