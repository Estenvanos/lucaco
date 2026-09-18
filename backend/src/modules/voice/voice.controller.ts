import type { Server, Socket } from "socket.io";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { joinSchema, screenSchema, signalSchema, streamWatchSchema } from "./voice.schema.js";
import * as voiceService from "./voice.services.js";

export async function join(io: Server, socket: Socket, payload: unknown) {
  const { channelId } = joinSchema.parse(payload);
  return { peers: await voiceService.join(io, socket.id, socket.data.userId, channelId) };
}

export async function leave(io: Server, socket: Socket) {
  await voiceService.leave(io, socket.id);
  return { ok: true };
}

export async function watch(io: Server, socket: Socket, payload: unknown) {
  const { channelId } = joinSchema.parse(payload);
  return { participants: await voiceService.watch(io, socket.id, socket.data.userId, channelId) };
}

export function unwatch(io: Server, socket: Socket, payload: unknown) {
  const { channelId } = joinSchema.parse(payload);
  voiceService.unwatch(io, socket.id, channelId);
  return { ok: true };
}

export async function screen(io: Server, socket: Socket, payload: unknown) {
  const { sharing } = screenSchema.parse(payload);
  if (!(await voiceService.setSharing(io, socket.id, socket.data.userId, sharing))) {
    throw new HttpError(409, "Join a room first");
  }
  return { ok: true };
}

export async function watchStream(io: Server, socket: Socket, payload: unknown) {
  const { socketId } = streamWatchSchema.parse(payload);
  await voiceService.watchStream(io, socket.id, socketId);
  return { ok: true };
}

export async function unwatchStream(io: Server, socket: Socket) {
  await voiceService.unwatchStream(io, socket.id);
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
