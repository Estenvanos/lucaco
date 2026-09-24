import { openContextMenu } from "../../lib/context-menu";
import { formatShortDateTime, initials, messagePreview } from "../../lib/utils";
import type { ConversationsListProps } from "../../types/ui.types";
import { UserActionsMenu } from "./UserActionsMenu";

export function ConversationsList({ conversations, unread, onOpen }: ConversationsListProps) {
  if (conversations.length === 0) {
    return <p className="inbox-empty">Nenhuma conversa ainda.</p>;
  }

  return (
    <ul className="inbox-list">
      {conversations.map(({ peer, lastMessageAt, lastMessage }) => {
        const name = peer.displayName ?? peer.username;
        const fromPeer = lastMessage?.senderId === peer.id;
        return (
          <li key={peer.id} onContextMenu={openContextMenu}>
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
                <span className="conversation-head">
                  <strong>{name}</strong>
                  <time dateTime={lastMessageAt}>{formatShortDateTime(lastMessageAt)}</time>
                </span>
                <span className="conversation-preview">
                  {lastMessage && !fromPeer && (
                    <svg className="conversation-sent" viewBox="0 0 16 11" aria-label="Enviada por você">
                      <path d="M1 5.5 4.5 9 11 2M6 8l1 1 7.5-7.5" />
                    </svg>
                  )}
                  {messagePreview(lastMessage)}
                </span>
              </span>
              {unread.has(peer.id) && <span className="unread-dot" title="Mensagens não lidas" />}
            </button>
            <UserActionsMenu user={{ id: peer.id, username: peer.username, name }} />
          </li>
        );
      })}
    </ul>
  );
}
