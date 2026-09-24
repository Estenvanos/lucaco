export const serversKeys = {
  all: ["servers"] as const,
  list: () => [...serversKeys.all, "list"] as const,
  search: (query: string) => [...serversKeys.all, "search", query] as const,
  discover: (query: string, category: string | null) =>
    [...serversKeys.all, "discover", query, category] as const,
  detail: (serverId: string) => [...serversKeys.all, "detail", serverId] as const,
  channels: (serverId: string) => [...serversKeys.detail(serverId), "channels"] as const,
  members: (serverId: string) => [...serversKeys.detail(serverId), "members"] as const,
  roles: (serverId: string) => [...serversKeys.detail(serverId), "roles"] as const,
  permissions: (serverId: string) => [...serversKeys.detail(serverId), "permissions"] as const,
  bans: (serverId: string) => [...serversKeys.detail(serverId), "bans"] as const,
  channelPermissions: (channelId: string) => [...serversKeys.all, "channel-permissions", channelId] as const,
};
