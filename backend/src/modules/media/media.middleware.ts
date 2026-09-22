import multer from "multer";
import { MEDIA_UPLOAD_MAX_BYTES } from "./media.schema.js";

/** Reads the file from multipart field `file` into memory (its kind's ceiling is checked by mediaFileSchema). */
// ponytail: memoryStorage holds up to 100 MB per upload in RAM (and the browser encrypts it whole);
// a presigned PUT straight to MinIO is the upgrade if concurrent video uploads hurt.
export const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MEDIA_UPLOAD_MAX_BYTES, files: 1 },
}).single("file");
