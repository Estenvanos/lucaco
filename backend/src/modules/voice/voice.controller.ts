import type { Server, Socket } from "socket.io";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { joinSchema, screenSchema, signalSchema } from "./voice.schema.js";
import * as voiceService from "./voice.services.js";

export async function join(io: Server, socket: Socket, payload: unknown) {
  const { roomId } = joinSchema.parse(payload);
  return { peers: await voiceService.join(io, socket.id, roomId) };
}

export async function leave(io: Server, socket: Socket) {
  await voiceService.leave(io, socket.id);
  return { ok: true };
}

export function screen(io: Server, socket: Socket, payload: unknown) {
  const { sharing } = screenSchema.parse(payload);
  if (!voiceService.setSharing(io, socket.id, sharing)) throw new HttpError(409, "Join a room first");
  return { ok: true };
}

export function signal(io: Server, socket: Socket, payload: unknown) {
  const { to, ...data } = signalSchema.parse(payload);
  if (!voiceService.canSignal(io, socket.id, to)) throw new HttpError(403, "Peer is not in your room");
  // ICE candidates are not logged: dozens per connection would flood the output.
  if (data.description) {
    const target = io.sockets.sockets.get(to)?.data.username;
    logger.info(`voice: ${socket.data.username} sent ${data.description.type} to ${target}`);
  }
  io.to(to).emit("voice:signal", { from: socket.id, ...data });
  return { ok: true };
}
