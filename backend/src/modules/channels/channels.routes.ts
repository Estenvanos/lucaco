import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { limits } from "../../lib/rate-limit.js";
import * as channelsController from "./channels.controller.js";

// Mounted at /servers/:serverId/channels; mergeParams keeps serverId from the parent router.
export const serverChannelsRouter = Router({ mergeParams: true });

serverChannelsRouter.get("/", channelsController.list);
serverChannelsRouter.post("/", limits.config, channelsController.create);

// A channel id is globally unique, so editing it does not need the server in the path.
export const channelsRouter = Router();

channelsRouter.use(requireAuth);
channelsRouter.get("/:channelId", channelsController.get);
channelsRouter.patch("/:channelId", limits.config, channelsController.update);
channelsRouter.delete("/:channelId", limits.config, channelsController.remove);
channelsRouter.get("/:channelId/permissions", channelsController.getPermissions);
channelsRouter.put("/:channelId/permissions/roles/:roleId", limits.config, channelsController.setRolePermission);
channelsRouter.put("/:channelId/permissions/members/:memberId", limits.config, channelsController.setMemberPermission);
