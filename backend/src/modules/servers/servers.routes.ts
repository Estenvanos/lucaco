import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { imageUpload } from "../images/images.middleware.js";
import { serverChannelsRouter } from "../channels/channels.routes.js";
import { auditRouter } from "../audit/audit.routes.js";
import { rolesRouter } from "../roles/roles.routes.js";
import { rulesRouter } from "../rules/rules.routes.js";
import { limits } from "../../lib/rate-limit.js";
import * as serversController from "./servers.controller.js";

export const serversRouter = Router();

serversRouter.use(requireAuth);

serversRouter.post("/", limits.config, serversController.create);
serversRouter.get("/", serversController.list);
// Literal paths before /:serverId, or they match as an id.
serversRouter.get("/search", serversController.search);
serversRouter.get("/discover", serversController.discover);
serversRouter.post("/invites/:code/accept", limits.config, serversController.acceptInvite);
serversRouter.get("/:serverId", serversController.get);
serversRouter.patch("/:serverId", limits.config, serversController.update);
serversRouter.delete("/:serverId", limits.config, serversController.remove);
serversRouter.put("/:serverId/icon", limits.upload, imageUpload("icon"), serversController.updateIcon);
serversRouter.put("/:serverId/banner", limits.upload, imageUpload("banner"), serversController.updateBanner);
serversRouter.get("/:serverId/members", serversController.listMembers);
serversRouter.get("/:serverId/permissions", serversController.myPermissions);
serversRouter.post("/:serverId/members", limits.config, serversController.join);
serversRouter.post("/:serverId/invites", limits.config, serversController.createInvite);
serversRouter.delete("/:serverId/members/me", limits.config, serversController.leave);
serversRouter.delete("/:serverId/members/:userId", limits.config, serversController.kick);
serversRouter.get("/:serverId/bans", serversController.listBans);
serversRouter.put("/:serverId/bans/:userId", limits.config, serversController.ban);
serversRouter.delete("/:serverId/bans/:userId", limits.config, serversController.unban);

// Roles and channels always live under a server: /servers/:serverId/...
serversRouter.use("/:serverId/roles", rolesRouter);
serversRouter.use("/:serverId/channels", serverChannelsRouter);
serversRouter.use("/:serverId/rules", rulesRouter);
serversRouter.use("/:serverId/audit-log", auditRouter);
