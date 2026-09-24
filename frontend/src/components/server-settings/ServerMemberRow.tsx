import { colorToHex } from "../../lib/utils";
import type { ServerMemberRowProps } from "../../types/ui.types";
import { ChatAvatar } from "../chat/ChatAvatar";

/** One member: roles as toggles, then admin, kick and ban where allowed. */
export function ServerMemberRow({ member, list }: ServerMemberRowProps) {
  return (
    <li className="server-member-row">
      <div className="server-member-row-head">
        <ChatAvatar user={{ ...member, id: member.userId }} />
        <span className="server-member-row-name">
          <strong>{list.nameOf(member)}</strong>
          <small>
            @{member.username}
            {list.isOwner(member) ? " · dono" : member.isAdmin ? " · admin" : ""}
          </small>
        </span>
        <div className="server-member-row-actions">
          {list.canSetAdmin(member) && (
            <button type="button" className="button button-ghost" onClick={() => list.toggleAdmin(member)}>
              {member.isAdmin ? "Rebaixar admin" : "Tornar admin"}
            </button>
          )}
          {list.canKick(member) && (
            <button type="button" className="button button-ghost" onClick={() => list.kick(member)}>
              Expulsar
            </button>
          )}
          {list.canBanMember(member) && (
            <button type="button" className="button button-danger" onClick={() => list.ban(member)}>
              Banir
            </button>
          )}
        </div>
      </div>
      {list.canManageRoles && list.roles.length > 0 && (
        <div className="server-member-chips">
          {list.roles.map((role) => (
            <button
              key={role.id}
              type="button"
              className="tag-chip"
              aria-pressed={member.roleIds.includes(role.id)}
              style={{ "--chip": colorToHex(role.color) } as React.CSSProperties}
              title={member.roleIds.includes(role.id) ? "Tirar cargo" : "Dar cargo"}
              onClick={() => list.toggleRole(member, role.id)}
            >
              {role.name}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
