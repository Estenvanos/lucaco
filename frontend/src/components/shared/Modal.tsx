import type { ModalProps } from "../../types/ui.types";

/**
 * Native <dialog>: the top layer, the backdrop, Esc-to-close and the focus trap are the
 * platform's job. The ref callback opens it on mount, so no effect is involved.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <dialog className="modal" ref={(el) => el?.showModal()} onClose={onClose}>
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
