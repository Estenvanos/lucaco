import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { limits } from "../../lib/rate-limit.js";
import * as mediaController from "./media.controller.js";
import { mediaUpload } from "./media.middleware.js";

export const mediaRouter = Router();

mediaRouter.use(requireAuth);
mediaRouter.post("/", limits.upload, mediaUpload, mediaController.upload);
mediaRouter.get("/:mediaId", mediaController.get);
