import type { Server, Socket } from "socket.io";
import { toErrorResponse } from "./error-handler.js";
import { logger } from "./logger.js";

export type SocketHandler = (io: Server, socket: Socket, payload: unknown) => unknown;

/** Socket equivalent of the Express error handler: result or error goes back through the ack. */
export function on(io: Server, socket: Socket, event: string, handler: SocketHandler) {
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

/** Every socket joins a room named after its user, so modules can reach a user by id. */
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Authentication, the per-user room and connection logging: what every socket module needs
 * before its own events. Module routers then add their handlers on their own `connection` listener.
 */
export function initSocket(io: Server, requireSocketAuth: Parameters<Server["use"]>[0]) {
  io.use(requireSocketAuth);
  io.on("connection", (socket) => {
    socket.join(userRoom(socket.data.userId));
    logger.info(`socket: ${socket.data.username} connected (${socket.id})`);
    socket.on("disconnecting", (reason) =>
      logger.info(`socket: ${socket.data.username} disconnected (${reason})`),
    );
  });
}
