import { USER_STATUS_LABEL } from "../../constants/user-status";
import type { MemberListProps } from "../../types/ui.types";
import { openContextMenu } from "../../lib/context-menu";
import { ChatAvatar } from "../chat/ChatAvatar";
import { UserActionsMenu } from "../shared/UserActionsMenu";

export function MemberList({ server, members, currentUserId }: MemberListProps) {
  return (
    <aside className="server-members" aria-label="Membros">
      <h2>Membros — {members.length}</h2>
      <ul>
        {members.map((member) => (
          <li key={member.id} data-status={member.status} onContextMenu={openContextMenu}>
            <span className="server-member-avatar">
              <ChatAvatar user={{ ...member, id: member.userId }} />
              <span className="status-dot" data-status={member.status} title={USER_STATUS_LABEL[member.status]} />
            </span>
            <span className="server-member-name" data-admin={member.isAdmin || undefined}>
              <strong>{member.nickname ?? member.displayName ?? member.username}</strong>
              {member.userId === currentUserId && <span className="server-member-you">(você)</span>}
            </span>
            <UserActionsMenu
              user={{
                id: member.userId,
                username: member.username,
                name: member.nickname ?? member.displayName ?? member.username,
              }}
              member={{ serverId: server.id, ownerId: server.ownerId, memberId: member.id, isAdmin: member.isAdmin }}
            />
          </li>
        ))}
      </ul>
    </aside>
  );
}
