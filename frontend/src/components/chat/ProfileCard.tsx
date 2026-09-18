import { openContextMenu } from "../../lib/context-menu";
import type { ProfileCardProps } from "../../types/ui.types";
import { UserActionsMenu } from "../shared/UserActionsMenu";
import { ChatAvatar } from "./ChatAvatar";

export function ProfileCard({ user }: ProfileCardProps) {
  return (
    <aside className="chat-profile" aria-label="Perfil" onContextMenu={openContextMenu}>
      <div className="chat-profile-banner" />
      <div className="chat-profile-body">
        <ChatAvatar user={user} size="lg" />
        <h2>{user.displayName ?? user.username}</h2>
        <p className="chat-profile-username">{user.username}</p>
        <h3>Membro desde</h3>
        <p>{new Date(user.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <UserActionsMenu user={{ id: user.id, username: user.username, name: user.displayName ?? user.username }} />
    </aside>
  );
}
