import type { Server } from "socket.io";
import { logger } from "../../lib/logger.js";

export type Peer = { socketId: string; userId: string; username: string; sharing: boolean };

const roomKey = (roomId: string) => `voice:${roomId}`;

// ponytail: P2P mesh with room state inside Socket.IO (single API instance, ~4-6 people per room).
// Next steps from the architecture doc: servers/roles permission check (CONNECT/STREAM),
// @socket.io/redis-adapter for multiple instances, mediasoup SFU replacing the mesh.

export async function join(io: Server, socketId: string, roomId: string) {
  const socket = io.sockets.sockets.get(socketId)!;
  if (socket.data.roomId) await leave(io, socketId);

  const peers: Peer[] = (await io.in(roomKey(roomId)).fetchSockets()).map((s) => ({
    socketId: s.id,
    userId: s.data.userId,
    username: s.data.username,
    sharing: Boolean(s.data.sharing),
  }));

  socket.join(roomKey(roomId));
  socket.data.roomId = roomId;
  logger.info(`voice: ${socket.data.username} joined room ${roomId} (${peers.length} already there)`);
  socket.to(roomKey(roomId)).emit("voice:peer-joined", {
    socketId,
    userId: socket.data.userId,
    username: socket.data.username,
    sharing: false,
  } satisfies Peer);

  return peers;
}

export async function leave(io: Server, socketId: string) {
  const socket = io.sockets.sockets.get(socketId);
  const roomId: string | undefined = socket?.data.roomId;
  if (!socket || !roomId) return;
  socket.leave(roomKey(roomId));
  socket.data.roomId = undefined;
  if (socket.data.sharing) logger.info(`voice: ${socket.data.username} stopped sharing in room ${roomId}`);
  socket.data.sharing = false;
  logger.info(`voice: ${socket.data.username} left room ${roomId}`);
  io.to(roomKey(roomId)).emit("voice:peer-left", { socketId });
}

/** Broadcasts screen share state so everyone in the room (and late joiners) can see who is sharing. */
export function setSharing(io: Server, socketId: string, sharing: boolean) {
  const socket = io.sockets.sockets.get(socketId);
  const roomId: string | undefined = socket?.data.roomId;
  if (!socket || !roomId) return false;
  socket.data.sharing = sharing;
  logger.info(`voice: ${socket.data.username} ${sharing ? "started" : "stopped"} sharing in room ${roomId}`);
  socket.to(roomKey(roomId)).emit("voice:screen", { socketId, sharing });
  return true;
}

/** Only peers in the same room can signal each other. */
export function canSignal(io: Server, from: string, to: string) {
  const roomId = io.sockets.sockets.get(from)?.data.roomId;
  return Boolean(roomId) && io.sockets.sockets.get(to)?.data.roomId === roomId;
}
