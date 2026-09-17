import { Outlet, redirect } from "react-router";
import { ROUTES } from "../constants/routes";
import { getAccessToken, refreshAccessToken } from "../lib/api";
import { queryClient } from "../lib/query-client";
import { fetchMe } from "../services/users/users.api";
import { usersKeys } from "../services/users/users.keys";
import { AppHeader } from "../components/shared/AppHeader";

/**
 * Session bootstrap. Runs before the tree renders, which is why no component needs an effect:
 * on a cold load there is no access token in memory, so the refresh cookie is exchanged here.
 */
export async function rootLoader() {
  try {
    if (!getAccessToken()) await refreshAccessToken();
    await queryClient.ensureQueryData({ queryKey: usersKeys.me(), queryFn: fetchMe });
    return null;
  } catch {
    return redirect(ROUTES.signIn);
  }
}

export function RootLayout() {
  return (
    <div className="root-layout">
      <AppHeader />
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
