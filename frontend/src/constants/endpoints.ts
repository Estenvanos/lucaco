/** Every API path lives here: only lib/api.ts and services/ consume them. */
export const ENDPOINTS = {
  auth: {
    signUp: "/auth/sign-up",
    signIn: "/auth/sign-in",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
  },
  users: {
    me: "/users/me",
    avatar: "/users/me/avatar",
  },
} as const;
