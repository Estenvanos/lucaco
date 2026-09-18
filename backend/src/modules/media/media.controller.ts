import type { Request, Response } from "express";
import { mediaFileSchema, mediaIdSchema, uploadTargetSchema } from "./media.schema.js";
import * as mediaService from "./media.services.js";

/** POST /media (multipart: file + peerId or channelId) */
export async function upload(req: Request, res: Response) {
  const target = uploadTargetSchema.parse(req.body);
  const file = mediaFileSchema.parse(req.file);
  res.status(201).json(await mediaService.upload(req.auth!.sub, target, file));
}

/** GET /media/:mediaId -> { url } */
export async function get(req: Request, res: Response) {
  const { mediaId } = mediaIdSchema.parse(req.params);
  res.json(await mediaService.getUrl(mediaId, req.auth!.sub));
}
