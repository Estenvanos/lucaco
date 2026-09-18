import { z } from "zod";
import { SERVER_CATEGORIES } from "../../lib/constants.js";

export const serverVisibilitySchema = z.enum(["public", "private"]);
export const serverCategorySchema = z.enum(SERVER_CATEGORIES);
const descriptionSchema = z.string().trim().max(300);

export const serverIdSchema = z.object({
  serverId: z.string().uuid(),
});

export const inviteCodeSchema = z.object({
  code: z.string().regex(/^[A-Za-z0-9_-]{12}$/, "Invalid invite code"),
});

export const searchServersSchema = z.object({
  q: z.string().max(100).default(""),
});

export const discoverServersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  category: serverCategorySchema.optional(),
});

export const createServerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  visibility: serverVisibilitySchema,
  category: serverCategorySchema.default("other"),
  // Empty string from a blank textarea means "no description".
  description: descriptionSchema.transform((value) => value || null).nullish(),
});

export const updateServerSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    visibility: serverVisibilitySchema.optional(),
    category: serverCategorySchema.optional(),
    description: descriptionSchema.transform((value) => value || null).nullish(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one property is required",
  });

export const createInviteSchema = z.object({
  maxUses: z.number().int().positive().max(10_000).nullish(),
  expiresAt: z.coerce.date().min(new Date(), "Expiration must be in the future").nullish(),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type UpdateServerInput = z.infer<typeof updateServerSchema>;
export type DiscoverServersInput = z.infer<typeof discoverServersSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
