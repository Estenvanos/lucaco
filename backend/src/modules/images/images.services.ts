import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { HttpError } from "../../lib/http-error.js";
import { deleteObject, putObject } from "../../lib/storage.js";
import { IMAGE_PRESETS, type ImageFile, type ImageFolder } from "./images.schema.js";

// Keeps decompression bombs out: 4096x4096 is plenty for any preset.
const MAX_INPUT_PIXELS = 4096 * 4096;

export async function toWebp(file: ImageFile, folder: ImageFolder) {
  const { width, height, quality } = IMAGE_PRESETS[folder];
  try {
    return await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS }) // first frame only for gif
      .rotate() // apply EXIF orientation; metadata (EXIF/GPS) is dropped on output
      .resize(width, height, { fit: "cover" })
      .webp({ quality })
      .toBuffer();
  } catch {
    throw new HttpError(400, "Invalid or unsupported image");
  }
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
