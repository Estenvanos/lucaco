import { useNavigate } from "react-router";
import { ROUTES } from "../../constants/routes";
import { useLogout } from "../../services/auth/auth.api";
import { useMe } from "../../services/users/users.api";
import { Button } from "./Button";

export function AppHeader() {
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  const onLogout = () => logout.mutate(undefined, { onSettled: () => navigate(ROUTES.signIn) });

  return (
    <header className="app-header">
      <strong>{me?.displayName ?? me?.username}</strong>
      <Button onClick={onLogout} loading={logout.isPending}>
        Sair
      </Button>
    </header>
  );
}
