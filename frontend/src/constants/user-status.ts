import type { UserStatus } from "../types/users.types";

/** The three statuses a user can pick, in menu order. */
export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  online: "Online",
  dnd: "Não perturbe",
  offline: "Offline",
};
