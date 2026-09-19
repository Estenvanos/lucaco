import type { Server, Socket } from "socket.io";
import { toErrorResponse } from "./error-handler.js";
import { HttpError } from "./http-error.js";
import { logger } from "./logger.js";
import type { SocketLimiter } from "./rate-limit.js";

export type SocketHandler = (io: Server, socket: Socket, payload: unknown) => unknown;

/**
 * Socket equivalent of the Express error handler: result or error goes back through the ack.
 * With a limiter, a user over the limit gets a 429 ack and the handler never runs.
 */
export function on(io: Server, socket: Socket, event: string, handler: SocketHandler, limiter?: SocketLimiter) {
  socket.on(event, async (payload: unknown, ack?: (res: unknown) => void) => {
    try {
      const wait = await limiter?.hit(socket.data.userId);
      if (wait) throw new HttpError(429, `Too many requests, try again in ${wait}s`);
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

let ioRef: Server | null = null;

/**
 * Pushes an event to every open tab of a user. Lets a service called from HTTP (a friend
 * request) reach the other side live. A no-op before the socket server starts (tests, scripts).
 */
export function emitToUser(userId: string, event: string, payload: unknown) {
  ioRef?.to(userRoom(userId)).emit(event, payload);
}

/**
 * Authentication, the per-user room and connection logging: what every socket module needs
 * before its own events. Module routers then add their handlers on their own `connection` listener.
 */
export function initSocket(io: Server, requireSocketAuth: Parameters<Server["use"]>[0]) {
  ioRef = io;
  io.use(requireSocketAuth);
  io.on("connection", (socket) => {
    socket.join(userRoom(socket.data.userId));
    logger.info(`socket: ${socket.data.username} connected (${socket.id})`);
    socket.on("disconnecting", (reason) =>
      logger.info(`socket: ${socket.data.username} disconnected (${reason})`),
    );
  });
}
