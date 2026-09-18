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
  servers: {
    root: "/servers",
    detail: (serverId: string) => `/servers/${serverId}`,
    members: (serverId: string) => `/servers/${serverId}/members`,
    acceptInvite: (code: string) => `/servers/invites/${code}/accept`,
  },
} as const;
