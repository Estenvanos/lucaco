import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { limits } from "../../lib/rate-limit.js";
import * as friendsController from "./friends.controller.js";

export const friendsRouter = Router();

friendsRouter.use(requireAuth);

friendsRouter.get("/", friendsController.list);
friendsRouter.post("/", limits.config, friendsController.request);
friendsRouter.post("/:userId/accept", limits.config, friendsController.accept);
friendsRouter.delete("/:userId", limits.config, friendsController.remove);
friendsRouter.put("/:userId/block", limits.config, friendsController.block);
friendsRouter.delete("/:userId/block", limits.config, friendsController.unblock);
