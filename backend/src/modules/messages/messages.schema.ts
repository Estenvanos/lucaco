import { z } from "zod";

/**
 * Ciphertext ceiling for a text message. The server cannot see what is inside, so this is the
 * only defence against someone using the collection as storage. Files go through `media`.
 */
export const CIPHERTEXT_MAX_CHARS = 8 * 1024;

const base64 = z.string().base64();

const messageBody = {
  ciphertext: base64.min(1).max(CIPHERTEXT_MAX_CHARS),
  iv: base64.min(8).max(64), // 12 random bytes for AES-GCM
  clientMessageId: z.string().uuid(),
  // "audio": the ciphertext holds { mediaId, iv, ... } of an encrypted file in the media module.
  contentType: z.enum(["text", "audio"]).default("text"),
};

export const sendMessageSchema = z.object({ peerId: z.string().uuid(), ...messageBody });

/** A channel message names the key epoch it was encrypted with (arquitetura-lucaco.md 7.2). */
export const sendChannelMessageSchema = z.object({
  channelId: z.string().uuid(),
  keyEpoch: z.number().int().min(1),
  ...messageBody,
});

const cursor = {
  // Cursor: the oldest ObjectId already on screen. Pages go backwards in time.
  before: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid cursor")
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
};

export const historySchema = z.object({ peerId: z.string().uuid(), ...cursor });
export const channelHistorySchema = z.object({ channelId: z.string().uuid(), ...cursor });

export const channelParamsSchema = z.object({ channelId: z.string().uuid() });
export const epochParamsSchema = z.object({
  channelId: z.string().uuid(),
  epoch: z.coerce.number().int().min(1),
});

/** The epoch key wrapped for one recipient. Opaque to the server, like the messages. */
const shareSchema = z.object({
  recipientId: z.string().uuid(),
  encryptedKey: base64.min(1).max(256),
  iv: base64.min(8).max(64),
});

const sharesSchema = z
  .array(shareSchema)
  .min(1)
  .max(1000)
  .refine((shares) => new Set(shares.map((s) => s.recipientId)).size === shares.length, {
    message: "One share per recipient",
  });

export const createEpochSchema = z.object({ epoch: z.number().int().min(1), shares: sharesSchema });
export const addSharesSchema = z.object({ shares: sharesSchema });

export const peerSchema = z.object({
  peerId: z.string().uuid(),
});

export type PeerInput = z.infer<typeof peerSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type HistoryInput = z.infer<typeof historySchema>;
export type SendChannelMessageInput = z.infer<typeof sendChannelMessageSchema>;
export type ChannelHistoryInput = z.infer<typeof channelHistorySchema>;
export type CreateEpochInput = z.infer<typeof createEpochSchema>;
export type AddSharesInput = z.infer<typeof addSharesSchema>;
