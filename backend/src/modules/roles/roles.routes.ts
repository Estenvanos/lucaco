import { Router } from "express";
import * as rolesController from "./roles.controller.js";

// Mounted at /servers/:serverId/roles; mergeParams keeps serverId from the parent router.
export const rolesRouter = Router({ mergeParams: true });

rolesRouter.get("/", rolesController.list);
rolesRouter.post("/", rolesController.create);
rolesRouter.patch("/:roleId", rolesController.update);
rolesRouter.delete("/:roleId", rolesController.remove);
rolesRouter.put("/:roleId/members/:memberId", rolesController.assign);
rolesRouter.delete("/:roleId/members/:memberId", rolesController.unassign);
