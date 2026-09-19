import { Router } from "express";
import { limits } from "../../lib/rate-limit.js";
import * as authController from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

export const authRouter = Router();

authRouter.post("/sign-up", limits.signUp, authController.signUp);
authRouter.post("/sign-in", limits.signInIp, limits.signIn, authController.signIn);
authRouter.post("/refresh", limits.refresh, authController.refresh);
authRouter.post("/logout", authController.logout);
authRouter.get("/token", requireAuth, authController.getToken);
authRouter.patch("/password", requireAuth, limits.sensitive, authController.changePassword);
authRouter.patch("/email", requireAuth, limits.sensitive, authController.changeEmail);
