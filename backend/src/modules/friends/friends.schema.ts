import { z } from "zod";

export const friendParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const friendRequestSchema = z.object({
  userId: z.string().uuid(),
});

export const listFriendsSchema = z.object({
  status: z.enum(["accepted", "pending", "blocked"]).default("accepted"),
});

export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
export type ListFriendsInput = z.infer<typeof listFriendsSchema>;
