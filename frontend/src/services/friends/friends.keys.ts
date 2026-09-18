export const friendsKeys = {
  all: ["friends"] as const,
  list: () => [...friendsKeys.all, "list"] as const,
  sent: () => [...friendsKeys.all, "sent"] as const,
};
