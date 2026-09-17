export const usersKeys = {
  all: ["users"] as const,
  me: () => [...usersKeys.all, "me"] as const,
  detail: (id: string) => [...usersKeys.all, "detail", id] as const,
};
