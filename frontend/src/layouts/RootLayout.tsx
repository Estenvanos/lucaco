import { Navigate, Outlet } from "react-router";
import { ROUTES } from "../constants/routes";
import { useAuth } from "../hooks/useAuth";
import { Sidebar } from "../components/shell/Sidebar";
import { TopBar } from "../components/shell/TopBar";

/** Logged-in area: renders nothing while the session resolves, sends guests to sign-in. */
export function RootLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to={ROUTES.signIn} replace />;

  return (
    // styles.css reads data-theme through :has(), so the tokens on :root and <body> follow it.
    <div className="root-layout" data-theme={user?.settings.theme}>
      <Sidebar />
      <div className="root-main">
        <TopBar />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
