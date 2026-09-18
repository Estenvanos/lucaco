import { AuthContext } from "../contexts/auth.context";
import { useMe } from "../services/users/users.api";
import type { AuthProviderProps } from "../types/auth.types";

/**
 * Session state for the whole app. No token bootstrap needed: on a cold load `GET /users/me`
 * answers 401, `request` exchanges the refresh cookie and retries, so `useMe` alone resolves it.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { data: user, isPending } = useMe();

  return (
    <AuthContext value={{ user: user ?? null, isAuthenticated: !!user, isLoading: isPending }}>
      {children}
    </AuthContext>
  );
}
