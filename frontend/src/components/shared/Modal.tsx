import type { ModalProps } from "../../types/ui.types";

/**
 * Native <dialog>: the top layer, the backdrop, Esc-to-close and the focus trap are the
 * platform's job. The ref callback opens it on mount, so no effect is involved.
 */
export function Modal({ title, onClose, children, origin }: ModalProps) {
  // The dialog is centred by the platform, so the animation starts offset by origin - centre.
  const open = (el: HTMLDialogElement | null) => {
    // The ref runs again on every render (new function): an open dialog must not reopen.
    if (!el || el.open) return;
    if (origin) {
      el.style.setProperty("--from-x", `${origin.x - window.innerWidth / 2}px`);
      el.style.setProperty("--from-y", `${origin.y - window.innerHeight / 2}px`);
    }
    el.showModal();
  };

  return (
    <dialog className="modal" ref={open} onClose={onClose}>
      <header className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </header>
      {children}
    </dialog>
  );
}
