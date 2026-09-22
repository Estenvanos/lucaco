import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { HttpError } from "../../lib/http-error.js";
import { deleteObject, putObject } from "../../lib/storage.js";
import { IMAGE_PRESETS, type ImageFile, type ImageFolder } from "./images.schema.js";

// Keeps decompression bombs out: 4096x4096 is plenty for any preset.
// ponytail: for an animated gif/webp sharp counts every frame, so a long gif over this is refused;
// a per-frame limit (check pages * pageHeight ourselves) if people hit it.
const MAX_INPUT_PIXELS = 4096 * 4096;

/** What the bytes really are (sharp reads the magic bytes); avif reports as heif. The mimetype is only a claim. */
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp", "gif", "heif"]);

export async function toWebp(file: Pick<ImageFile, "buffer"> & Partial<ImageFile>, folder: ImageFolder) {
  const { width, height, quality } = IMAGE_PRESETS[folder];
  const chat = folder === "attachments" || folder === "attachmentPreviews";
  const fit = chat ? "inside" : "cover";
  // Chat images keep a gif's animation; avatars and icons take the first frame.
  const image = sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, animated: chat });
  const format = await image.metadata().then((meta) => meta.format, () => undefined);
  if (!format || !ACCEPTED_FORMATS.has(format)) throw new HttpError(400, "Invalid or unsupported image");
  try {
    return await image
      .rotate() // apply EXIF orientation; metadata (EXIF/GPS) is dropped on output
      .resize(width, height, { fit, withoutEnlargement: fit === "inside" })
      .webp({ quality })
      .toBuffer();
  } catch {
    throw new HttpError(400, "Invalid or unsupported image");
  }
}

/** Width and height of one frame (an animated webp's metadata height is all frames stacked). */
export async function dimensions(buffer: Buffer) {
  const { width, height, pageHeight } = await sharp(buffer).metadata();
  return { width, height: pageHeight ?? height };
}

/** Compresses to webp and stores it. Returns the storage key. */
export async function store(file: ImageFile, folder: ImageFolder, ownerId: string) {
  const key = `images/${folder}/${ownerId}/${randomUUID()}.webp`;
  await putObject(key, await toWebp(file, folder), "image/webp");
  return key;
}

export async function remove(key: string) {
  await deleteObject(key);
}
