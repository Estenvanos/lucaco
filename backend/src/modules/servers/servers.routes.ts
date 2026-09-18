import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { imageUpload } from "../images/images.middleware.js";
import { serverChannelsRouter } from "../channels/channels.routes.js";
import { rolesRouter } from "../roles/roles.routes.js";
import * as serversController from "./servers.controller.js";

export const serversRouter = Router();

serversRouter.use(requireAuth);

serversRouter.post("/", serversController.create);
serversRouter.get("/", serversController.list);
serversRouter.post("/invites/:code/accept", serversController.acceptInvite);
serversRouter.get("/:serverId", serversController.get);
serversRouter.patch("/:serverId", serversController.update);
serversRouter.delete("/:serverId", serversController.remove);
serversRouter.put("/:serverId/icon", imageUpload("icon"), serversController.updateIcon);
serversRouter.get("/:serverId/members", serversController.listMembers);
serversRouter.post("/:serverId/members", serversController.join);
serversRouter.post("/:serverId/invites", serversController.createInvite);
serversRouter.delete("/:serverId/members/me", serversController.leave);

// Roles and channels always live under a server: /servers/:serverId/...
serversRouter.use("/:serverId/roles", rolesRouter);
serversRouter.use("/:serverId/channels", serverChannelsRouter);
