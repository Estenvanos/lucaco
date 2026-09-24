import { z } from "zod";

/**
 * Ciphertext ceiling for a text message. The server cannot see what is inside, so this is the
 * only defence against someone using the collection as storage. Files go through `media`.
 */
export const CIPHERTEXT_MAX_CHARS = 8 * 1024;

const base64 = z.string().base64();
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid message id");

const messageBody = {
  ciphertext: base64.min(1).max(CIPHERTEXT_MAX_CHARS),
  iv: base64.min(8).max(64), // 12 random bytes for AES-GCM
  clientMessageId: z.string().uuid(),
  // Anything but "text" carries a file from the media module: the ciphertext holds how to open it
  // ({ mediaId, key, iv, ... }) and `mediaId` repeats the id in the clear so deleting the message
  // can delete the file.
  contentType: z.enum(["text", "audio", "image", "file", "video"]).default("text"),
  mediaId: z.string().uuid().optional(),
  /** The message this one replies to, in the same conversation. */
  answerFor: objectId.optional(),
};

const carriesFile = (m: { contentType: string; mediaId?: string }) => (m.contentType === "text") === !m.mediaId;
const carriesFileError = { message: "Attach a file exactly when the message is not text", path: ["mediaId"] };

export const sendMessageSchema = z
  .object({ peerId: z.string().uuid(), ...messageBody })
  .refine(carriesFile, carriesFileError);

/** A channel message names the key epoch it was encrypted with (arquitetura-lucaco.md 7.2). */
export const sendChannelMessageSchema = z
  .object({
    channelId: z.string().uuid(),
    keyEpoch: z.number().int().min(1),
    /** The text is encrypted, so the client says who it mentions (@todos = everyone). */
    mentions: z
      .object({ everyone: z.boolean().default(false), userIds: z.array(z.uuid()).max(20).default([]) })
      .default({ everyone: false, userIds: [] }),
    ...messageBody,
  })
  .refine(carriesFile, carriesFileError);

/** `peerId` is needed for a DM only: its conversation id cannot be turned back into the peer. */
export const deleteMessageSchema = z.object({
  messageId: objectId,
  peerId: z.string().uuid().optional(),
});

/** Toggles one emoji of the caller on a message. A single emoji only, no text. */
export const reactMessageSchema = deleteMessageSchema.extend({
  // RegExp(): a /v literal needs target ES2024.
  emoji: z.string().max(32).regex(new RegExp("^\\p{RGI_Emoji}$", "v"), "Not an emoji"),
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
export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;
export type ReactMessageInput = z.infer<typeof reactMessageSchema>;
export type SendChannelMessageInput = z.infer<typeof sendChannelMessageSchema>;
export type ChannelHistoryInput = z.infer<typeof channelHistorySchema>;
export type CreateEpochInput = z.infer<typeof createEpochSchema>;
export type AddSharesInput = z.infer<typeof addSharesSchema>;
