import { initials } from "../../lib/utils";
import type { SentRequestsListProps } from "../../types/ui.types";

/** Pending requests I sent: same row look as the inbox, with a cancel button. */
export function SentRequestsList({ requests, busy, onCancel }: SentRequestsListProps) {
  if (requests.length === 0) {
    return <p className="inbox-empty">Nenhuma solicitação pendente.</p>;
  }

  return (
    <ul className="inbox-list">
      {requests.map(({ id, userId, user, createdAt }) => (
        <li key={id} className="inbox-item">
          <span className="inbox-avatar" aria-hidden>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.displayName ?? user.username)}
          </span>
          <div className="inbox-text">
            <strong>{user.displayName ?? user.username}</strong>
            <p>Aguardando resposta</p>
            <time dateTime={createdAt}>{new Date(createdAt).toLocaleString("pt-BR")}</time>
          </div>
          <div className="inbox-actions">
            <button type="button" className="inbox-decline" title="Cancelar" disabled={busy === userId}
              onClick={() => onCancel(userId)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
              <span className="sr-only">Cancelar</span>
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
