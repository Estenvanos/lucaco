import { USER_STATUS_LABEL } from "../../constants/user-status";
import type { MemberListProps } from "../../types/ui.types";
import { ChatAvatar } from "../chat/ChatAvatar";

export function MemberList({ members }: MemberListProps) {
  return (
    <aside className="server-members" aria-label="Membros">
      <h2>Membros — {members.length}</h2>
      <ul>
        {members.map((member) => (
          <li key={member.id} data-status={member.status}>
            <span className="server-member-avatar">
              <ChatAvatar user={{ ...member, id: member.userId }} />
              <span className="status-dot" data-status={member.status} title={USER_STATUS_LABEL[member.status]} />
            </span>
            <span className="server-member-name">
              <strong>{member.nickname ?? member.displayName ?? member.username}</strong>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
