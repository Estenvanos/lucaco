import type { Request, Response } from "express";
import {
  adminParamsSchema,
  assignParamsSchema,
  createRoleSchema,
  roleParamsSchema,
  updateRoleSchema,
} from "./roles.schema.js";
import * as rolesService from "./roles.services.js";

export async function list(req: Request, res: Response) {
  const { serverId } = roleParamsSchema.parse(req.params);
  res.json(await rolesService.list(serverId, req.auth!.sub));
}

export async function create(req: Request, res: Response) {
  const { serverId } = roleParamsSchema.parse(req.params);
  const role = await rolesService.create(serverId, req.auth!.sub, createRoleSchema.parse(req.body));
  res.status(201).json(role);
}

export async function update(req: Request, res: Response) {
  const { serverId, roleId } = roleParamsSchema.parse(req.params);
  const role = await rolesService.update(serverId, roleId!, req.auth!.sub, updateRoleSchema.parse(req.body));
  res.json(role);
}

export async function remove(req: Request, res: Response) {
  const { serverId, roleId } = roleParamsSchema.parse(req.params);
  await rolesService.remove(serverId, roleId!, req.auth!.sub);
  res.status(204).end();
}

export async function assign(req: Request, res: Response) {
  const { serverId, roleId, memberId } = assignParamsSchema.parse(req.params);
  await rolesService.assign(serverId, roleId, memberId, req.auth!.sub);
  res.status(204).end();
}

export async function unassign(req: Request, res: Response) {
  const { serverId, roleId, memberId } = assignParamsSchema.parse(req.params);
  await rolesService.unassign(serverId, roleId, memberId, req.auth!.sub);
  res.status(204).end();
}

export async function grantAdmin(req: Request, res: Response) {
  const { serverId, memberId } = adminParamsSchema.parse(req.params);
  await rolesService.setAdmin(serverId, memberId, req.auth!.sub, true);
  res.status(204).end();
}

export async function revokeAdmin(req: Request, res: Response) {
  const { serverId, memberId } = adminParamsSchema.parse(req.params);
  await rolesService.setAdmin(serverId, memberId, req.auth!.sub, false);
  res.status(204).end();
}
