import { Router } from "express";
import { limits } from "../../lib/rate-limit.js";
import * as rulesController from "./rules.controller.js";

// Mounted at /servers/:serverId/rules; mergeParams keeps serverId from the parent router.
export const rulesRouter = Router({ mergeParams: true });

rulesRouter.get("/", rulesController.list);
rulesRouter.put("/", limits.config, rulesController.replace);
