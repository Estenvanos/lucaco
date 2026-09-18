import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { imageUpload } from "../images/images.middleware.js";
import * as usersController from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, usersController.getMe);
usersRouter.patch("/me", requireAuth, usersController.updateProfile);
usersRouter.patch("/me/settings", requireAuth, usersController.updateSettings);
usersRouter.patch("/me/status", requireAuth, usersController.updateStatus);
usersRouter.put("/me/avatar", requireAuth, imageUpload("avatar"), usersController.updateAvatar);
usersRouter.put("/me/keys", requireAuth, usersController.publishKey);
// Peers fetch each other's public key to derive the shared DM key (ECDH).
usersRouter.get("/:userId/key", requireAuth, usersController.getKey);
