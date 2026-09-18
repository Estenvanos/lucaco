import { Router } from "express";
import type { Server } from "socket.io";
import { SOCKET_EVENTS } from "../../lib/constants.js";
import { on } from "../../lib/socket.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as messagesController from "./messages.controller.js";

export const messagesRouter = Router();

messagesRouter.get("/", requireAuth, messagesController.history);

export function registerMessagesSocket(io: Server) {
  io.on("connection", (socket) => {
    on(io, socket, SOCKET_EVENTS.messageSend, messagesController.send);
  });
}
