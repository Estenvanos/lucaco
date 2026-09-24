import type { Request, Response } from "express";
import { auditParamsSchema, listAuditSchema } from "./audit.schema.js";
import * as auditService from "./audit.services.js";

export async function list(req: Request, res: Response) {
  const { serverId } = auditParamsSchema.parse(req.params);
  res.json(await auditService.list(serverId, req.auth!.sub, listAuditSchema.parse(req.query)));
}
