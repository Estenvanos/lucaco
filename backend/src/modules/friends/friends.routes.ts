import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import * as friendsController from "./friends.controller.js";

export const friendsRouter = Router();

friendsRouter.use(requireAuth);

friendsRouter.get("/", friendsController.list);
friendsRouter.post("/", friendsController.request);
friendsRouter.post("/:userId/accept", friendsController.accept);
friendsRouter.delete("/:userId", friendsController.remove);
friendsRouter.put("/:userId/block", friendsController.block);
friendsRouter.delete("/:userId/block", friendsController.unblock);
