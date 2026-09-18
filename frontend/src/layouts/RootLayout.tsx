import { Navigate, Outlet } from "react-router";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { Sidebar } from "../components/shell/Sidebar";

/** Logged-in area: renders nothing while the session resolves, sends guests to sign-in. */
export function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to={ROUTES.signIn} replace />;

  return (
    <div className="root-layout">
      <Sidebar />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
