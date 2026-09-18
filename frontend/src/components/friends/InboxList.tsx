import { initials } from "../../lib/utils";
import type { InboxListProps } from "../../types/ui.types";

const icon = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const CHECK = icon("M5 12.5l4.5 4.5L19 7.5");
const CROSS = icon("M6 6l12 12M18 6L6 18");

export function InboxList({ notifications, busy, onAccept, onDecline }: InboxListProps) {
  if (notifications.length === 0) {
    return <p className="inbox-empty">Nenhum pedido de amizade.</p>;
  }

  return (
    <ul className="inbox-list">
      {notifications.map(({ id, title, subtitle, createdAt, owner }) => {
        const disabled = busy === owner.id;
        return (
          <li key={id} className="inbox-item">
            <span className="inbox-avatar" aria-hidden>
              {owner.avatarUrl ? <img src={owner.avatarUrl} alt="" /> : initials(owner.displayName ?? owner.username)}
            </span>
            <div className="inbox-text">
              <strong>{title}</strong>
              {subtitle && <p>{subtitle}</p>}
              <time dateTime={createdAt}>{new Date(createdAt).toLocaleString("pt-BR")}</time>
            </div>
            <div className="inbox-actions">
              <button type="button" className="inbox-accept" title="Aceitar" disabled={disabled}
                onClick={() => onAccept(owner.id)}>
                {CHECK}
                <span className="sr-only">Aceitar</span>
              </button>
              <button type="button" className="inbox-decline" title="Recusar" disabled={disabled}
                onClick={() => onDecline(owner.id)}>
                {CROSS}
                <span className="sr-only">Recusar</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
