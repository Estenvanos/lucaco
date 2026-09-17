import { Outlet } from "react-router";

export function AuthLayout() {
  return (
    <div className="auth-layout">
      <aside className="auth-brand">
        <img
          className="auth-brand-logo"
          src="/images/logo_auth.png"
          alt="Lucaco"
          width={1147}
          height={534}
        />
        <p className="auth-brand-legal">© {new Date().getFullYear()} Lucaco</p>
      </aside>

      <main className="auth-panel">
        <div className="auth-form">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
