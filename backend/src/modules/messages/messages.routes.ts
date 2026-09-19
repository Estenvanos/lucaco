import { Router } from "express";
import type { Server } from "socket.io";
import { SOCKET_EVENTS } from "../../lib/constants.js";
import { socketLimits } from "../../lib/rate-limit.js";
import { on } from "../../lib/socket.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as messagesController from "./messages.controller.js";

export const messagesRouter = Router();

messagesRouter.get("/", requireAuth, messagesController.history);
messagesRouter.get("/conversations", requireAuth, messagesController.conversations);
messagesRouter.post("/read", requireAuth, messagesController.markRead);
// Sender keys of a server text channel (arquitetura-lucaco.md 7.2).
messagesRouter.get("/channels/:channelId/keys", requireAuth, messagesController.channelKeys);
messagesRouter.post("/channels/:channelId/keys", requireAuth, messagesController.createEpoch);
messagesRouter.post("/channels/:channelId/keys/:epoch/shares", requireAuth, messagesController.addShares);

export function registerMessagesSocket(io: Server) {
  io.on("connection", (socket) => {
    on(io, socket, SOCKET_EVENTS.messageSend, messagesController.send, socketLimits.messageSend);
    on(io, socket, SOCKET_EVENTS.messageTyping, messagesController.typing, socketLimits.typing);
  });
}
