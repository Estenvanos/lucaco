import type { Request, Response } from "express";
import { imageFileSchema } from "../images/images.schema.js";
import * as usersService from "./users.services.js";

export async function getMe(req: Request, res: Response) {
  res.json(await usersService.toPublicUser(await usersService.getById(req.auth!.sub)));
}

export async function updateAvatar(req: Request, res: Response) {
  const user = await usersService.updateAvatar(req.auth!.sub, imageFileSchema.parse(req.file));
  res.json(await usersService.toPublicUser(user));
}
