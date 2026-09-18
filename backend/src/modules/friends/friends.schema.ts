import { z } from "zod";

export const friendParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const friendRequestSchema = z.object({
  username: z.string().trim().min(1).max(32),
  message: z.string().trim().max(120).transform((value) => value || undefined).optional(),
});

export const listFriendsSchema = z.object({
  status: z.enum(["accepted", "pending", "blocked"]).default("accepted"),
});

export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
export type ListFriendsInput = z.infer<typeof listFriendsSchema>;
