import { z } from "zod";

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

export const createChannelSchema = z.object({
  name: nameSchema,
  // A second voice channel is rejected by the one_voice_per_server partial unique index (409).
  type: z.enum(["text", "voice"]).default("text"),
  topic: z.string().trim().max(1024).nullish(),
  position: z.number().int().min(0).max(1000).optional(),
});

export const updateChannelSchema = z
  .object({
    name: nameSchema.optional(),
    topic: z.string().trim().max(1024).nullish(),
    position: z.number().int().min(0).max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one property is required" });

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
