import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { imageUpload } from "../images/images.middleware.js";
import { limits } from "../../lib/rate-limit.js";
import * as usersController from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, usersController.getMe);
usersRouter.patch("/me", requireAuth, limits.config, usersController.updateProfile);
usersRouter.patch("/me/settings", requireAuth, limits.config, usersController.updateSettings);
usersRouter.patch("/me/status", requireAuth, limits.config, usersController.updateStatus);
usersRouter.put("/me/avatar", requireAuth, limits.upload, imageUpload("avatar"), usersController.updateAvatar);
usersRouter.put("/me/keys", requireAuth, limits.config, usersController.publishKey);
// Own key only (req.auth.sub): the encrypted private key never goes to anyone else.
usersRouter.get("/me/key-backup", requireAuth, usersController.getKeyBackup);
usersRouter.put("/me/mutes/:userId", requireAuth, limits.config, usersController.mute);
usersRouter.delete("/me/mutes/:userId", requireAuth, limits.config, usersController.unmute);
// Peers fetch each other's public key to derive the shared DM key (ECDH).
usersRouter.get("/:userId/key", requireAuth, usersController.getKey);
