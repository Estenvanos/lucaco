import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { imageUpload } from "../images/images.middleware.js";
import * as usersController from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, usersController.getMe);
usersRouter.put("/me/avatar", requireAuth, imageUpload("avatar"), usersController.updateAvatar);
