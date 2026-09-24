import type { Request, Response } from "express";
import { replaceRulesSchema, rulesParamsSchema } from "./rules.schema.js";
import * as rulesService from "./rules.services.js";

export async function list(req: Request, res: Response) {
  const { serverId } = rulesParamsSchema.parse(req.params);
  res.json(await rulesService.list(serverId, req.auth!.sub));
}

export async function replace(req: Request, res: Response) {
  const { serverId } = rulesParamsSchema.parse(req.params);
  res.json(await rulesService.replace(serverId, req.auth!.sub, replaceRulesSchema.parse(req.body)));
}
