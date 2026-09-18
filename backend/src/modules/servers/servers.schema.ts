import { z } from "zod";

export const serverVisibilitySchema = z.enum(["public", "private"]);

export const serverIdSchema = z.object({
  serverId: z.string().uuid(),
});

export const inviteCodeSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{12}$/, "Invalid invite code"),
});

export const createServerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  visibility: serverVisibilitySchema,
});

export const updateServerSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    visibility: serverVisibilitySchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.visibility !== undefined, {
    message: "At least one property is required",
  });

export const createInviteSchema = z.object({
  maxUses: z.number().int().positive().max(10_000).nullish(),
  expiresAt: z.coerce.date().min(new Date(), "Expiration must be in the future").nullish(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
