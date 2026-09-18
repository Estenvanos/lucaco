import type { Request, Response } from "express";
import { imageFileSchema } from "../images/images.schema.js";
import {
  createInviteSchema,
  createServerSchema,
  inviteCodeSchema,
  serverIdSchema,
  updateServerSchema,
} from "./servers.schema.js";
import * as serversService from "./servers.services.js";

export async function create(req: Request, res: Response) {
  const server = await serversService.create(req.auth!.sub, createServerSchema.parse(req.body));
  res.status(201).json(await serversService.toPublicServer(server));
}

export async function list(req: Request, res: Response) {
  const servers = await serversService.listForUser(req.auth!.sub);
  res.json(await Promise.all(servers.map(serversService.toPublicServer)));
}

export async function get(req: Request, res: Response) {
  const { serverId } = serverIdSchema.parse(req.params);
  await serversService.getMember(serverId, req.auth!.sub);
  res.json(await serversService.toPublicServer(await serversService.getById(serverId)));
}

export async function update(req: Request, res: Response) {
  const { serverId } = serverIdSchema.parse(req.params);
  const server = await serversService.update(serverId, req.auth!.sub, updateServerSchema.parse(req.body));
  res.json(await serversService.toPublicServer(server));
}

export async function remove(req: Request, res: Response) {
  const { serverId } = serverIdSchema.parse(req.params);
  await serversService.remove(serverId, req.auth!.sub);
  res.status(204).end();
}

export async function listMembers(req: Request, res: Response) {
  const { serverId } = serverIdSchema.parse(req.params);
  await serversService.getMember(serverId, req.auth!.sub);
  res.json(await serversService.listMembers(serverId));
}

export async function join(req: Request, res: Response) {
  const { serverId } = serverIdSchema.parse(req.params);
  const member = await serversService.join(serverId, req.auth!.sub);
  res.status(201).json({ id: member.id, serverId: member.serverId, joinedAt: member.joinedAt });
}

export async function createInvite(req: Request, res: Response) {
  const { serverId } = serverIdSchema.parse(req.params);
  const invite = await serversService.createInvite(
    serverId,
    req.auth!.sub,
    createInviteSchema.parse(req.body ?? {}),
  );
  res.status(201).json(invite);
}

export async function acceptInvite(req: Request, res: Response) {
  const { code } = inviteCodeSchema.parse(req.params);
  const member = await serversService.acceptInvite(code, req.auth!.sub);
  res.status(201).json({ id: member.id, serverId: member.serverId, joinedAt: member.joinedAt });
}

export async function leave(req: Request, res: Response) {
  const { serverId } = serverIdSchema.parse(req.params);
  await serversService.leave(serverId, req.auth!.sub);
  res.status(204).end();
}

export async function updateIcon(req: Request, res: Response) {
  const { serverId } = serverIdSchema.parse(req.params);
  const server = await serversService.updateIcon(serverId, req.auth!.sub, imageFileSchema.parse(req.file));
  res.json(await serversService.toPublicServer(server));
}
