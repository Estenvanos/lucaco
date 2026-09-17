import { z } from "zod";

export const serverIdSchema = z.object({
  serverId: z.string().uuid(),
});

export const createServerSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export const updateServerSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
