import { Router } from "express";
import { limits } from "../../lib/rate-limit.js";
import * as rolesController from "./roles.controller.js";

// Mounted at /servers/:serverId/roles; mergeParams keeps serverId from the parent router.
export const rolesRouter = Router({ mergeParams: true });

rolesRouter.get("/", rolesController.list);
rolesRouter.post("/", limits.config, rolesController.create);
// Literal before /:roleId, or "admin" matches as a role id.
rolesRouter.put("/admin/members/:memberId", limits.config, rolesController.grantAdmin);
rolesRouter.delete("/admin/members/:memberId", limits.config, rolesController.revokeAdmin);
rolesRouter.patch("/:roleId", limits.config, rolesController.update);
rolesRouter.delete("/:roleId", limits.config, rolesController.remove);
rolesRouter.put("/:roleId/members/:memberId", limits.config, rolesController.assign);
rolesRouter.delete("/:roleId/members/:memberId", limits.config, rolesController.unassign);
