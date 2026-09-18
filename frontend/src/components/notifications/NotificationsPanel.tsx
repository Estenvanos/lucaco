import { initials } from "../../lib/utils";
import type { NotificationsPanelProps } from "../../types/ui.types";

/**
 * Drawer on the right edge. Native <dialog> like Modal: Esc, backdrop and focus trap come from
 * the platform; the ref callback opens it on mount, no effect.
 */
export function NotificationsPanel({ notifications, busy, onClose, onOpen, onDismiss }: NotificationsPanelProps) {
  const open = (el: HTMLDialogElement | null) => {
    if (el && !el.open) el.showModal();
  };

  return (
    <dialog
      className="notifications-panel"
      ref={open}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself, not on its content.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <header className="modal-head">
        <h2>Notificações</h2>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </header>

      {notifications.length === 0 ? (
        <p className="inbox-empty">Nenhuma notificação.</p>
      ) : (
        <ul className="notifications-list">
          {notifications.map((notification) => {
            const { id, title, subtitle, createdAt, owner } = notification;
            return (
              <li key={id} className="notifications-item">
                <button type="button" className="notifications-open" onClick={() => onOpen(notification)}>
                  <span className="inbox-avatar" aria-hidden>
                    {owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initials(owner.displayName ?? owner.username)}
                  </span>
                  <span className="inbox-text">
                    <strong>{title}</strong>
                    {subtitle && <p>{subtitle}</p>}
                    <time dateTime={createdAt}>{new Date(createdAt).toLocaleString("pt-BR")}</time>
                  </span>
                </button>
                <button
                  type="button"
                  className="notifications-dismiss"
                  title="Dispensar"
                  disabled={busy === id}
                  onClick={() => onDismiss(id)}
                >
                  ✕<span className="sr-only">Dispensar</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}
