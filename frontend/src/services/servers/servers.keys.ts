export const serversKeys = {
  all: ["servers"] as const,
  list: () => [...serversKeys.all, "list"] as const,
  detail: (serverId: string) => [...serversKeys.all, "detail", serverId] as const,
};
