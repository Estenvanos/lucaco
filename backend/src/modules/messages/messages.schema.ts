import { z } from "zod";

/**
 * Ciphertext ceiling for a text message. The server cannot see what is inside, so this is the
 * only defence against someone using the collection as storage. Files go through `media`.
 */
export const CIPHERTEXT_MAX_CHARS = 8 * 1024;

const base64 = z.string().base64();

export const sendMessageSchema = z.object({
  peerId: z.string().uuid(),
  ciphertext: base64.min(1).max(CIPHERTEXT_MAX_CHARS),
  iv: base64.min(8).max(64), // 12 random bytes for AES-GCM
  clientMessageId: z.string().uuid(),
  contentType: z.literal("text").default("text"),
});

export const historySchema = z.object({
  peerId: z.string().uuid(),
  // Cursor: the oldest ObjectId already on screen. Pages go backwards in time.
  before: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid cursor")
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type HistoryInput = z.infer<typeof historySchema>;
