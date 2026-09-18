import type { Request, Response } from "express";
import { notificationParamsSchema } from "./notifications.schema.js";
import * as notificationsService from "./notifications.services.js";

export async function list(req: Request, res: Response) {
  res.json(await notificationsService.list(req.auth!.sub));
}

export async function remove(req: Request, res: Response) {
  const { id } = notificationParamsSchema.parse(req.params);
  await notificationsService.remove(req.auth!.sub, id);
  res.status(204).end();
}
