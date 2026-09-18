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
    myKey: "/users/me/keys",
    key: (userId: string) => `/users/${userId}/key`,
  },
  friends: {
    root: "/friends",
    pending: "/friends?status=pending",
    accept: (userId: string) => `/friends/${userId}/accept`,
    detail: (userId: string) => `/friends/${userId}`,
  },
  messages: {
    conversations: "/messages/conversations",
    history: (peerId: string, before?: string) =>
      `/messages?${new URLSearchParams({ peerId, ...(before && { before }) })}`,
    read: "/messages/read",
  },
  notifications: {
    root: "/notifications",
    detail: (id: string) => `/notifications/${id}`,
  },
  servers: {
    root: "/servers",
    search: (query: string) => `/servers/search?q=${encodeURIComponent(query)}`,
    discover: (query: string, category: string | null) =>
      `/servers/discover?${new URLSearchParams({ q: query, ...(category && { category }) })}`,
    detail: (serverId: string) => `/servers/${serverId}`,
    image: (serverId: string, kind: "icon" | "banner") => `/servers/${serverId}/${kind}`,
    members: (serverId: string) => `/servers/${serverId}/members`,
    acceptInvite: (code: string) => `/servers/invites/${code}/accept`,
  },
} as const;
