import type { MouseEvent } from "react";
import { useUserActions } from "../../hooks/useUserActions";
import type { UserActionsMenuProps } from "../../types/ui.types";

/**
 * Right-click menu on a user (friend on the wheel, DM, member list). popover="auto" gives Esc and
 * click-outside for free; open it with openContextMenu. Nothing is rendered on your own row, so
 * the browser's menu shows there.
 */
export function UserActionsMenu(props: UserActionsMenuProps) {
  const actions = useUserActions(props);
  if (actions.isSelf) return null;
  const { user, member } = props;

  // Grab the popover now: React clears currentTarget before the mutation settles.
  const run = (action: (done: () => void) => void) => (event: MouseEvent<HTMLButtonElement>) => {
    const menu = event.currentTarget.closest<HTMLElement>("[popover]");
    action(() => menu?.hidePopover());
  };
  const moderation = actions.canSetAdmin || actions.canKick || actions.canBan;

  return (
    <div popover="auto" className="user-actions" role="menu" aria-label={user.name} onContextMenu={(e) => e.preventDefault()}>
      <p className="user-actions-name">{user.name}</p>
      {member &&
        (actions.isFriend ? (
          <button type="button" role="menuitem" onClick={run(actions.message)}>Mensagem</button>
        ) : (
          <button type="button" role="menuitem" onClick={run(actions.addFriend)}>Adicionar amigo</button>
        ))}
      <button type="button" role="menuitem" disabled title="Em breve">Convidar para o servidor</button>
      <button type="button" role="menuitem" onClick={run(actions.toggleMute)}>
        {actions.muted ? "Dessilenciar" : "Silenciar"}
      </button>
      {actions.isFriend && (
        <button type="button" role="menuitem" onClick={run(actions.unfriend)}>Desfazer amizade</button>
      )}
      <button type="button" role="menuitem" data-danger onClick={run(actions.block)}>Bloquear</button>
      {moderation && <hr />}
      {actions.canSetAdmin && (
        <button type="button" role="menuitem" onClick={run(actions.toggleAdmin)}>
          {actions.isAdmin ? "Remover admin" : "Tornar admin"}
        </button>
      )}
      {actions.canKick && (
        <button type="button" role="menuitem" data-danger onClick={run(actions.kick)}>Expulsar {user.name}</button>
      )}
      {actions.canBan && (
        <button type="button" role="menuitem" data-danger onClick={run(actions.ban)}>Banir {user.name}</button>
      )}
      {actions.error && <p className="form-error" role="alert">{actions.error}</p>}
    </div>
  );
}
