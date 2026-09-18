import { useNavigate } from "react-router";
import { ROUTES } from "../../constants/routes";
import { USER_STATUS_LABEL } from "../../constants/user-status";
import { initials } from "../../lib/utils";
import { useLogout } from "../../services/auth/auth.api";
import { useMe, useUpdateStatus } from "../../services/users/users.api";
import type { UserStatus } from "../../types/users.types";

export function UserMenu() {
  const { data: me } = useMe();
  const logout = useLogout();
  const updateStatus = useUpdateStatus();
  const navigate = useNavigate();
  const name = me?.displayName ?? me?.username ?? "";

  return (
    <>
      {/* popover="auto": the platform handles opening, Esc and click-outside. */}
      <button type="button" className="user-button" popoverTarget="user-menu" title={name}>
        {me?.avatarUrl ? <img src={me.avatarUrl} alt="" /> : <span>{initials(name)}</span>}
        <span className="sr-only">Abrir menu do usuário</span>
      </button>

      <div id="user-menu" popover="auto" className="user-menu">
        <p className="user-menu-name">{name}</p>
        {Object.entries(USER_STATUS_LABEL).map(([status, label]) => (
          <button
            key={status}
            type="button"
            aria-pressed={me?.status === status}
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate(status as UserStatus)}
          >
            <span className="status-dot" data-status={status} aria-hidden /> {label}
          </button>
        ))}
        <hr className="user-menu-divider" />
        <button type="button" onClick={() => navigate(ROUTES.settings())}>
          Configurações
        </button>
        <button
          type="button"
          onClick={() => logout.mutate(undefined, { onSettled: () => navigate(ROUTES.signIn) })}
        >
          {logout.isPending ? "Saindo..." : "Sair"}
        </button>
      </div>
    </>
  );
}
