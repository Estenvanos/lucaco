import type { FriendsTabsProps } from "../../types/ui.types";

/** Same top bar as Descobrir: reuses its classes so both pages stay in step. */
export function FriendsTabs({ tab, onChange, inboxCount, unreadCount }: FriendsTabsProps) {
  return (
    <header className="discover-nav">
      <nav className="discover-tabs" aria-label="Amigos">
        <button type="button" aria-current={tab === "inbox"} onClick={() => onChange("inbox")}>
          Caixa de entrada
          {inboxCount > 0 && <span className="friends-badge">{inboxCount}</span>}
        </button>
        <button type="button" aria-current={tab === "sent"} onClick={() => onChange("sent")}>
          Solicitações
        </button>
        <button type="button" aria-current={tab === "add"} onClick={() => onChange("add")}>
          Adicionar amigo
        </button>
        <button type="button" aria-current={tab === "conversations"} onClick={() => onChange("conversations")}>
          Conversas
          {unreadCount > 0 && <span className="friends-badge">{unreadCount}</span>}
        </button>
      </nav>
    </header>
  );
}
