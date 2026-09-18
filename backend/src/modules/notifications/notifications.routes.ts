import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import * as notificationsController from "./notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", notificationsController.list);
notificationsRouter.delete("/:id", notificationsController.remove);
