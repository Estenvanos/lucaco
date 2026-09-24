export const auditKeys = {
  all: ["audit"] as const,
  server: (serverId: string) => [...auditKeys.all, serverId] as const,
  list: (serverId: string, action: string | null) => [...auditKeys.server(serverId), action ?? "all"] as const,
};
