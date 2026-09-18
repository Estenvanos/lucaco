import type { Request, Response } from "express";
import {
  channelIdSchema,
  createChannelSchema,
  serverParamsSchema,
  updateChannelSchema,
} from "./channels.schema.js";
import * as channelsService from "./channels.services.js";

export async function list(req: Request, res: Response) {
  const { serverId } = serverParamsSchema.parse(req.params);
  res.json(await channelsService.list(serverId, req.auth!.sub));
}

export async function create(req: Request, res: Response) {
  const { serverId } = serverParamsSchema.parse(req.params);
  const channel = await channelsService.create(serverId, req.auth!.sub, createChannelSchema.parse(req.body));
  res.status(201).json(channel);
}

export async function get(req: Request, res: Response) {
  const { channelId } = channelIdSchema.parse(req.params);
  res.json(await channelsService.canView(channelId, req.auth!.sub));
}

export async function update(req: Request, res: Response) {
  const { channelId } = channelIdSchema.parse(req.params);
  const channel = await channelsService.update(channelId, req.auth!.sub, updateChannelSchema.parse(req.body));
  res.json(channel);
}

export async function remove(req: Request, res: Response) {
  const { channelId } = channelIdSchema.parse(req.params);
  await channelsService.remove(channelId, req.auth!.sub);
  res.status(204).end();
}
