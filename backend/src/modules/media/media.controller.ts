import type { Request, Response } from "express";
import { mediaFileSchema, mediaIdSchema, mediaKindSchema, uploadTargetSchema } from "./media.schema.js";
import * as mediaService from "./media.services.js";

/** POST /media (multipart: file + kind + peerId or channelId) -> { id, mime, size } */
export async function upload(req: Request, res: Response) {
  const target = uploadTargetSchema.parse(req.body);
  const { kind } = mediaKindSchema.parse(req.body);
  const file = mediaFileSchema(kind).parse(req.file);
  res.status(201).json(await mediaService.upload(req.auth!.sub, target, kind, file));
}

/** GET /media/:mediaId -> { url } */
export async function get(req: Request, res: Response) {
  const { mediaId } = mediaIdSchema.parse(req.params);
  res.json(await mediaService.getUrl(mediaId, req.auth!.sub));
}
