import { initials } from "../../lib/utils";
import type { ConversationsListProps } from "../../types/ui.types";

export function ConversationsList({ conversations, unread, onOpen }: ConversationsListProps) {
  if (conversations.length === 0) {
    return <p className="inbox-empty">Nenhuma conversa ainda.</p>;
  }

  return (
    <ul className="inbox-list">
      {conversations.map(({ peer, lastMessageAt }) => {
        const name = peer.displayName ?? peer.username;
        return (
          <li key={peer.id}>
            <button
              type="button"
              className="inbox-item conversation-item"
              data-unread={unread.has(peer.id) || undefined}
              onClick={() => onOpen(peer.id)}
            >
              <span className="inbox-avatar" aria-hidden>
                {peer.avatarUrl ? <img src={peer.avatarUrl} alt="" /> : initials(name)}
              </span>
              <span className="inbox-text">
                <strong>{name}</strong>
                <time dateTime={lastMessageAt}>
                  Última mensagem {new Date(lastMessageAt).toLocaleString("pt-BR")}
                </time>
              </span>
              {unread.has(peer.id) && <span className="unread-dot" title="Mensagens não lidas" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
