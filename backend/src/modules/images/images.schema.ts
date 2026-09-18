import { z } from "zod";

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// Each preset maps to its own storage folder: images/<folder>/<ownerId>/<id>.webp
export const IMAGE_PRESETS = {
  avatars: { width: 512, height: 512, quality: 80 },
  servers: { width: 256, height: 256, quality: 80 },
  banners: { width: 960, height: 400, quality: 78 }, // discovery card background, ~2.4:1
} as const;

export type ImageFolder = keyof typeof IMAGE_PRESETS;

export const imageFileSchema = z.object(
  {
    mimetype: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]),
    size: z.number().max(IMAGE_MAX_BYTES),
    buffer: z.instanceof(Buffer),
  },
  { error: "Send an image file (png, jpeg, webp, gif or avif, max 5MB)" },
);

export type ImageFile = z.infer<typeof imageFileSchema>;
