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

/**
 * Documents and videos that may be sent: extension -> the types a browser reports for it.
 * The frontend mirrors this in constants/limits.ts.
 */
export const MEDIA_FORMATS = {
  file: {
    pdf: ["application/pdf"],
    txt: ["text/plain"],
    csv: ["text/csv", "application/vnd.ms-excel"],
    md: ["text/markdown", "text/x-markdown", "text/plain"],
    doc: ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xls: ["application/vnd.ms-excel"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ppt: ["application/vnd.ms-powerpoint"],
    pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    odt: ["application/vnd.oasis.opendocument.text"],
    ods: ["application/vnd.oasis.opendocument.spreadsheet"],
    odp: ["application/vnd.oasis.opendocument.presentation"],
    zip: ["application/zip", "application/x-zip-compressed"],
    "7z": ["application/x-7z-compressed"],
    rar: ["application/vnd.rar", "application/x-rar-compressed"],
  },
  video: {
    mp4: ["video/mp4"],
    webm: ["video/webm"],
    mov: ["video/quicktime"],
    ogv: ["video/ogg"],
  },
} as const satisfies Record<"file" | "video", Record<string, readonly string[]>>;

/** `mime` is the type the browser gave the original file (the upload itself is ciphertext). */
export const mediaKindSchema = z.object({
  kind: z.enum(MEDIA_KINDS).default("voice"),
  mime: z.string().max(255).default(""),
});

const extension = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/**
 * Whether a document or video is of an allowed format: its extension must be listed, and its
 * declared type must be one of that extension's (or empty: browsers leave .md, .7z and friends
 * untyped). Both come from the sender — the bytes are ciphertext, so this keeps honest clients
 * to known formats but cannot prove what is inside.
 */
export function isAllowedFormat(kind: "file" | "video", name: string, mime: string) {
  const types: readonly string[] | undefined = (MEDIA_FORMATS[kind] as Record<string, readonly string[]>)[extension(name)];
  return !!types && (types.includes(mime) || (kind === "file" && (mime === "" || mime === "application/octet-stream")));
}

/**
 * voice/file/video arrive as ciphertext: the server checks the size and the declared format
 * (voice is recorded by the app itself). An image arrives in the clear, so its type is checked
 * here and its real bytes again when it is converted to webp.
 */
export const mediaFileSchema = (kind: MediaKind, mime = "") =>
  z
    .object(
      {
        size: z.number().min(1).max(MEDIA_MAX_BYTES[kind]),
        buffer: z.instanceof(Buffer),
        mimetype: z.string(),
        originalname: z.string().default(""),
      },
      { error: `Send one file (max ${MEDIA_MAX_BYTES[kind] / MB}MB)` },
    )
    .refine((file) => kind !== "image" || imageMimeSchema.safeParse(file.mimetype).success, {
      error: "Send an image file (png, jpeg, webp, gif or avif)",
    })
    .refine((file) => (kind !== "file" && kind !== "video") || isAllowedFormat(kind, file.originalname, mime), {
      error:
        kind === "video"
          ? `Unsupported video format (allowed: ${Object.keys(MEDIA_FORMATS.video).join(", ")})`
          : `Unsupported file format (allowed: ${Object.keys(MEDIA_FORMATS.file).join(", ")})`,
    });

/** Which conversation the file belongs to: a DM peer or a server text channel. */
export const uploadTargetSchema = z.union([
  z.object({ peerId: z.string().uuid() }),
  z.object({ channelId: z.string().uuid() }),
]);

export const mediaIdSchema = z.object({ mediaId: z.string().uuid() });

export type MediaFileInput = z.infer<ReturnType<typeof mediaFileSchema>>;
export type UploadTarget = z.infer<typeof uploadTargetSchema>;
