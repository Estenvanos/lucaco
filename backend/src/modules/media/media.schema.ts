import { z } from "zod";
import { imageMimeSchema } from "../images/images.schema.js";

const MB = 1024 * 1024;

export const MEDIA_KINDS = ["voice", "image", "file", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Size ceiling per kind. A voice message of the 2-minute client limit in opus is well under 5 MB.
 * The frontend mirrors these in constants/limits.ts.
 */
export const MEDIA_MAX_BYTES = { voice: 5 * MB, image: 15 * MB, file: 30 * MB, video: 100 * MB } as const;

/** Multer's ceiling: the largest kind; the exact one is checked once the body's `kind` is known. */
export const MEDIA_UPLOAD_MAX_BYTES = Math.max(...Object.values(MEDIA_MAX_BYTES));

export const mediaKindSchema = z.object({ kind: z.enum(MEDIA_KINDS).default("voice") });

/**
 * voice/file/video arrive as ciphertext: the server cannot check the type, only the size.
 * An image arrives in the clear (the server converts it to webp), so its type is checked.
 */
export const mediaFileSchema = (kind: MediaKind) =>
  z
    .object(
      {
        size: z.number().min(1).max(MEDIA_MAX_BYTES[kind]),
        buffer: z.instanceof(Buffer),
        mimetype: z.string(),
      },
      { error: `Send one file (max ${MEDIA_MAX_BYTES[kind] / MB}MB)` },
    )
    .refine((file) => kind !== "image" || imageMimeSchema.safeParse(file.mimetype).success, {
      error: "Send an image file (png, jpeg, webp, gif or avif)",
    });

/** Which conversation the file belongs to: a DM peer or a server text channel. */
export const uploadTargetSchema = z.union([
  z.object({ peerId: z.string().uuid() }),
  z.object({ channelId: z.string().uuid() }),
]);

export const mediaIdSchema = z.object({ mediaId: z.string().uuid() });

export type MediaFileInput = z.infer<ReturnType<typeof mediaFileSchema>>;
export type UploadTarget = z.infer<typeof uploadTargetSchema>;
