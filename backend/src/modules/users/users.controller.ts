import type { Request, Response } from "express";
import { imageFileSchema } from "../images/images.schema.js";
import {
  publishKeySchema,
  updateProfileSchema,
  updateSettingsSchema,
  updateStatusSchema,
  userIdSchema,
} from "./users.schema.js";
import * as usersService from "./users.services.js";

export async function getMe(req: Request, res: Response) {
  res.json(await usersService.toPublicUser(await usersService.getById(req.auth!.sub)));
}

export async function updateProfile(req: Request, res: Response) {
  const user = await usersService.updateProfile(req.auth!.sub, updateProfileSchema.parse(req.body));
  res.json(await usersService.toPublicUser(user));
}

export async function updateSettings(req: Request, res: Response) {
  const user = await usersService.updateSettings(req.auth!.sub, updateSettingsSchema.parse(req.body));
  res.json(await usersService.toPublicUser(user));
}

export async function updateStatus(req: Request, res: Response) {
  const user = await usersService.updateStatus(req.auth!.sub, updateStatusSchema.parse(req.body));
  res.json(await usersService.toPublicUser(user));
}

export async function updateAvatar(req: Request, res: Response) {
  const user = await usersService.updateAvatar(req.auth!.sub, imageFileSchema.parse(req.file));
  res.json(await usersService.toPublicUser(user));
}

export async function publishKey(req: Request, res: Response) {
  const key = await usersService.publishKey(req.auth!.sub, publishKeySchema.parse(req.body));
  res.status(201).json({ publicKey: key.publicKey, algorithm: key.algorithm, createdAt: key.createdAt });
}

export async function getKey(req: Request, res: Response) {
  const { userId } = userIdSchema.parse(req.params);
  res.json(await usersService.getActiveKey(userId));
}
