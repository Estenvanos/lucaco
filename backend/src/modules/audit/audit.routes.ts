import { Router } from "express";
import * as auditController from "./audit.controller.js";

// Mounted at /servers/:serverId/audit-log; mergeParams keeps serverId from the parent router.
export const auditRouter = Router({ mergeParams: true });

auditRouter.get("/", auditController.list);
