import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS } from "../../lib/constants.js";
import { toErrorResponse } from "../../lib/error-handler.js";
import { logger } from "../../lib/logger.js";
import { requireSocketAuth } from "../auth/auth.middleware.js";
import * as voiceController from "./voice.controller.js";

type Handler = (io: Server, socket: Socket, payload: unknown) => unknown;

/** Socket equivalent of the Express error handler: result or error goes back through the ack. */
function on(io: Server, socket: Socket, event: string, handler: Handler) {
  socket.on(event, async (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      // `ack?.(await handler())` would skip the handler when there is no ack: optional call does not evaluate its arguments.
      const result = await handler(io, socket, payload);
      ack?.(result);
    } catch (err) {
      const { status, body } = toErrorResponse(err);
      logger.warn(`socket: ${event} by ${socket.data.username} failed (${status})`, body);
      ack?.(body);
    }
  });
}

export function registerVoiceSocket(io: Server) {
  io.use(requireSocketAuth);
  io.on("connection", (socket) => {
    logger.info(`socket: ${socket.data.username} connected (${socket.id})`);
    on(io, socket, SOCKET_EVENTS.voiceJoin, voiceController.join);
    on(io, socket, SOCKET_EVENTS.voiceLeave, voiceController.leave);
    on(io, socket, SOCKET_EVENTS.voiceSignal, voiceController.signal);
    on(io, socket, SOCKET_EVENTS.voiceScreen, voiceController.screen);
    socket.on("disconnecting", (reason) => {
      logger.info(`socket: ${socket.data.username} disconnected (${reason})`);
      voiceController.leave(io, socket);
    });
  });
}
