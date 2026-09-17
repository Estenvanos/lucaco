import multer from "multer";
import { IMAGE_MAX_BYTES } from "./images.schema.js";

/** Reads one image from multipart field `field` into memory (validated later by imageFileSchema). */
export const imageUpload = (field: string) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: IMAGE_MAX_BYTES, files: 1 } }).single(field);
