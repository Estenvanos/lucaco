import { useNavigate } from "react-router";
import { ROUTES } from "../../constants/routes";
import { initials } from "../../lib/utils";
import { useLogout } from "../../services/auth/auth.api";
import { useMe } from "../../services/users/users.api";

export function UserMenu() {
  const { data: me } = useMe();
  const logout = useLogout();
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
        <button type="button" disabled title="Em breve">
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
