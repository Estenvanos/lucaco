import type { Request, Response } from "express";
import { friendParamsSchema, friendRequestSchema, listFriendsSchema } from "./friends.schema.js";
import * as friendsService from "./friends.services.js";

export async function list(req: Request, res: Response) {
  res.json(await friendsService.list(req.auth!.sub, listFriendsSchema.parse(req.query)));
}

export async function request(req: Request, res: Response) {
  const { userId } = friendRequestSchema.parse(req.body);
  res.status(201).json(await friendsService.request(req.auth!.sub, userId));
}

export async function accept(req: Request, res: Response) {
  const { userId } = friendParamsSchema.parse(req.params);
  res.json(await friendsService.accept(req.auth!.sub, userId));
}

export async function remove(req: Request, res: Response) {
  const { userId } = friendParamsSchema.parse(req.params);
  await friendsService.remove(req.auth!.sub, userId);
  res.status(204).end();
}

export async function block(req: Request, res: Response) {
  const { userId } = friendParamsSchema.parse(req.params);
  res.json(await friendsService.block(req.auth!.sub, userId));
}

export async function unblock(req: Request, res: Response) {
  const { userId } = friendParamsSchema.parse(req.params);
  await friendsService.unblock(req.auth!.sub, userId);
  res.status(204).end();
}
