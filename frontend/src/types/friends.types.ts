import type { z } from "zod";
import type { addFriendSchema } from "../schemas/friends.schema";
import type { UserProfile } from "./users.types";

export type PublicFriendship = {
  id: string;
  /** The other side of the friendship. */
  userId: string;
  status: "accepted" | "pending" | "blocked";
  incoming: boolean;
  blockedByMe: boolean;
  createdAt: string;
  respondedAt: string | null;
  /** The other side's public profile. */
  user: UserProfile;
};

export type AddFriendInput = z.infer<typeof addFriendSchema>;

export type FriendsTab = "add" | "inbox" | "sent" | "conversations";

