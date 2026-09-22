import { z } from "zod";
import { CHANNEL_PERMISSIONS, VOICE_MAX_USERS } from "../../lib/constants.js";

export const channelIdSchema = z.object({
  channelId: z.string().uuid(),
});

/** Channels are listed and created under /servers/:serverId/channels. */
export const serverParamsSchema = z.object({
  serverId: z.string().uuid(),
});

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform((name) => name.toLowerCase().replace(/\s+/g, "-"));

const userLimitSchema = z.number().int().min(1).max(VOICE_MAX_USERS);

const permissionList = z.array(z.enum(CHANNEL_PERMISSIONS)).max(CHANNEL_PERMISSIONS.length);

/** allow/deny for one role or member; a bit cannot be in both. Both empty = "inherit" (row removed). */
export const overwriteSchema = z
  .object({ allow: permissionList.default([]), deny: permissionList.default([]) })
  .refine(({ allow, deny }) => !allow.some((p) => deny.includes(p)), {
    message: "A permission cannot be allowed and denied at once",
  });

export const roleOverwriteParamsSchema = z.object({
  channelId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const memberOverwriteParamsSchema = z.object({
  channelId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const createChannelSchema = z.object({
  name: nameSchema,
  // A second voice channel is rejected by the one_voice_per_server partial unique index (409).
  type: z.enum(["text", "voice"]).default("text"),
  topic: z.string().trim().max(1024).nullish(),
  position: z.number().int().min(0).max(1000).optional(),
  userLimit: userLimitSchema.optional(),
  // Created with the channel in one transaction, so a private channel is never briefly public.
  permissions: z
    .object({
      roles: z.array(overwriteSchema.and(z.object({ roleId: z.string().uuid() }))).max(100).default([]),
      members: z.array(overwriteSchema.and(z.object({ memberId: z.string().uuid() }))).max(100).default([]),
    })
    .default({ roles: [], members: [] }),
});

export const updateChannelSchema = z
  .object({
    name: nameSchema.optional(),
    topic: z.string().trim().max(1024).nullish(),
    position: z.number().int().min(0).max(1000).optional(),
    userLimit: userLimitSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one property is required" });

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type OverwriteInput = z.infer<typeof overwriteSchema>;
