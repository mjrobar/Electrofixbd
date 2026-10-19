import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function AdminDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const current = dialog.current!,
      focused = document.activeElement as HTMLElement | null,
      previous = document.body.style.overflow;
    current.showModal();
    document.body.style.overflow = "hidden";
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !current.open) return;
      const controls = Array.from(
        current.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.getClientRects().length > 0);
      const first = controls[0],
        last = controls.at(-1),
        active = document.activeElement;
      if (!first) {
        event.preventDefault();
        current.focus();
      } else if (
        event.shiftKey &&
        (active === first || !current.contains(active))
      ) {
        event.preventDefault();
        last!.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !current.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap, true);
    return () => {
      document.removeEventListener("keydown", trap, true);
      current.close();
      document.body.style.overflow = previous;
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="efb-admin-dialog"
      aria-label={title}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="efb-dialog-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="efb-icon-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={20} />
        </button>
      </div>
      <div className="efb-dialog-body">{children}</div>
    </dialog>
  );
}
