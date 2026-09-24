/** Every API path lives here: only lib/api.ts and services/ consume them. */
export const ENDPOINTS = {
  auth: {
    signUp: "/auth/sign-up",
    signIn: "/auth/sign-in",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
    password: "/auth/password",
    email: "/auth/email",
  },
  users: {
    me: "/users/me",
    avatar: "/users/me/avatar",
    status: "/users/me/status",
    settings: "/users/me/settings",
    myKey: "/users/me/keys",
    keyBackup: "/users/me/key-backup",
    key: (userId: string) => `/users/${userId}/key`,
    mute: (userId: string) => `/users/me/mutes/${userId}`,
  },
  friends: {
    root: "/friends",
    pending: "/friends?status=pending",
    accept: (userId: string) => `/friends/${userId}/accept`,
    detail: (userId: string) => `/friends/${userId}`,
    block: (userId: string) => `/friends/${userId}/block`,
  },
  messages: {
    conversations: "/messages/conversations",
    history: (peerId: string, before?: string) =>
      `/messages?${new URLSearchParams({ peerId, ...(before && { before }) })}`,
    channelHistory: (channelId: string, before?: string) =>
      `/messages?${new URLSearchParams({ channelId, ...(before && { before }) })}`,
    read: "/messages/read",
    channelKeys: (channelId: string) => `/messages/channels/${channelId}/keys`,
    channelShares: (channelId: string, epoch: number) => `/messages/channels/${channelId}/keys/${epoch}/shares`,
  },
  channels: {
    detail: (channelId: string) => `/channels/${channelId}`,
    permissions: (channelId: string) => `/channels/${channelId}/permissions`,
    rolePermission: (channelId: string, roleId: string) => `/channels/${channelId}/permissions/roles/${roleId}`,
    memberPermission: (channelId: string, memberId: string) =>
      `/channels/${channelId}/permissions/members/${memberId}`,
  },
  media: {
    root: "/media",
    detail: (mediaId: string) => `/media/${mediaId}`,
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
    channels: (serverId: string) => `/servers/${serverId}/channels`,
    roles: (serverId: string) => `/servers/${serverId}/roles`,
    permissions: (serverId: string) => `/servers/${serverId}/permissions`,
    member: (serverId: string, userId: string) => `/servers/${serverId}/members/${userId}`,
    ban: (serverId: string, userId: string) => `/servers/${serverId}/bans/${userId}`,
    bans: (serverId: string) => `/servers/${serverId}/bans`,
    roleMember: (serverId: string, roleId: string, memberId: string) =>
      `/servers/${serverId}/roles/${roleId}/members/${memberId}`,
    rules: (serverId: string) => `/servers/${serverId}/rules`,
    auditLog: (serverId: string, before: string | undefined, action: string | null) =>
      `/servers/${serverId}/audit-log?${new URLSearchParams({ ...(before && { before }), ...(action && { action }) })}`,
    admin: (serverId: string, memberId: string) => `/servers/${serverId}/roles/admin/members/${memberId}`,
    acceptInvite: (code: string) => `/servers/invites/${code}/accept`,
  },
} as const;
