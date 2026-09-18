import multer from "multer";
import { MEDIA_MAX_BYTES } from "./media.schema.js";

/** Reads the encrypted file from multipart field `file` into memory (validated by mediaFileSchema). */
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_MAX_BYTES, files: 1 },
}).single("file");
