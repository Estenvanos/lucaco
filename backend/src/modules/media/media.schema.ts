import { z } from "zod";

/** A voice message of the 2-minute client limit in opus is well under this; the rest is slack. */
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

/** Ciphertext: the server cannot check the type, only the size. */
export const mediaFileSchema = z.object(
  {
    size: z.number().min(1).max(MEDIA_MAX_BYTES),
    buffer: z.instanceof(Buffer),
  },
  { error: "Send one encrypted file (max 5MB)" },
);

/** Which conversation the file belongs to: a DM peer or a server text channel. */
export const uploadTargetSchema = z.union([
  z.object({ peerId: z.string().uuid() }),
  z.object({ channelId: z.string().uuid() }),
]);

export const mediaIdSchema = z.object({ mediaId: z.string().uuid() });

export type MediaFileInput = z.infer<typeof mediaFileSchema>;
export type UploadTarget = z.infer<typeof uploadTargetSchema>;
