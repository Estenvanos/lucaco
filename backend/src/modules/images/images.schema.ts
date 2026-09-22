import { z } from "zod";

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Each preset maps to its own storage folder: images/<folder>/<ownerId>/<id>.webp
export const IMAGE_PRESETS = {
  avatars: { width: 512, height: 512, quality: 80 },
  servers: { width: 256, height: 256, quality: 80 },
  banners: { width: 960, height: 400, quality: 78 }, // discovery card background, ~2.4:1
  attachments: { width: 2048, height: 2048, quality: 80 }, // chat images: shrunk to fit, never cropped or enlarged
  attachmentPreviews: { width: 480, height: 480, quality: 70 }, // what the chat shows (lazy); a click opens the full one
} as const;

export type ImageFolder = keyof typeof IMAGE_PRESETS;

export const imageMimeSchema = z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export const imageFileSchema = z.object(
  {
    mimetype: imageMimeSchema,
    size: z.number().max(IMAGE_MAX_BYTES),
    buffer: z.instanceof(Buffer),
  },
  { error: "Send an image file (png, jpeg, webp, gif or avif, max 5MB)" },
);

export type ImageFile = z.infer<typeof imageFileSchema>;
