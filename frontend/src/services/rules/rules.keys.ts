export const rulesKeys = {
  all: ["rules"] as const,
  list: (serverId: string) => [...rulesKeys.all, serverId] as const,
};
