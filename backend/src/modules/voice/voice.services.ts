import type { Server } from "socket.io";
import { SOCKET_EVENTS } from "../../lib/constants.js";
import { logger } from "../../lib/logger.js";
import * as channelsService from "../channels/channels.services.js";

export type Peer = { socketId: string; userId: string; username: string; sharing: boolean };

const roomKey = (channelId: string) => `voice:${channelId}`;
const watchersKey = (channelId: string) => `voice-watchers:${channelId}`;

async function participants(io: Server, channelId: string): Promise<Peer[]> {
  return (await io.in(roomKey(channelId)).fetchSockets()).map((socket) => ({
    socketId: socket.id,
    userId: socket.data.userId,
    username: socket.data.username,
    sharing: Boolean(socket.data.sharing),
  }));
}

async function announceParticipants(io: Server, channelId: string) {
  io.to(watchersKey(channelId)).emit(SOCKET_EVENTS.voiceParticipants, {
    channelId,
    participants: await participants(io, channelId),
  });
}

// ponytail: P2P mesh with room state inside Socket.IO (single API instance, ~4-6 people per room).
// Next steps from the architecture doc: @socket.io/redis-adapter for multiple instances and
// mediasoup SFU replacing the mesh.

export async function join(io: Server, socketId: string, userId: string, channelId: string) {
  await channelsService.canConnect(channelId, userId);
  const socket = io.sockets.sockets.get(socketId)!;
  if (socket.data.voiceChannelId) await leave(io, socketId);

  const peers: Peer[] = (await io.in(roomKey(channelId)).fetchSockets()).map((s) => ({
    socketId: s.id,
    userId: s.data.userId,
    username: s.data.username,
    sharing: Boolean(s.data.sharing),
  }));

  socket.join(roomKey(channelId));
  socket.data.voiceChannelId = channelId;
  logger.info(`voice: ${socket.data.username} joined channel ${channelId} (${peers.length} already there)`);
  socket.to(roomKey(channelId)).emit(SOCKET_EVENTS.voicePeerJoined, {
    socketId,
    userId: socket.data.userId,
    username: socket.data.username,
    sharing: false,
  } satisfies Peer);
  await announceParticipants(io, channelId);

  return peers;
}

export async function leave(io: Server, socketId: string) {
  const socket = io.sockets.sockets.get(socketId);
  const channelId: string | undefined = socket?.data.voiceChannelId;
  if (!socket || !channelId) return;
  socket.leave(roomKey(channelId));
  socket.data.voiceChannelId = undefined;
  if (socket.data.sharing) logger.info(`voice: ${socket.data.username} stopped sharing in channel ${channelId}`);
  socket.data.sharing = false;
  logger.info(`voice: ${socket.data.username} left channel ${channelId}`);
  io.to(roomKey(channelId)).emit(SOCKET_EVENTS.voicePeerLeft, { socketId });
  await announceParticipants(io, channelId);
}

/** Subscribes a server viewer to the roster without placing them in the WebRTC call. */
export async function watch(io: Server, socketId: string, userId: string, channelId: string) {
  const socket = io.sockets.sockets.get(socketId)!;
  socket.data.watchingVoiceChannelId = channelId;
  await channelsService.canViewVoice(channelId, userId);
  if (socket.data.watchingVoiceChannelId !== channelId) return [];

  const previous: string | undefined = socket.data.joinedVoiceWatchRoom;
  if (previous && previous !== channelId) socket.leave(watchersKey(previous));
  socket.join(watchersKey(channelId));
  socket.data.joinedVoiceWatchRoom = channelId;
  return participants(io, channelId);
}

export function unwatch(io: Server, socketId: string, channelId: string) {
  const socket = io.sockets.sockets.get(socketId);
  if (!socket || socket.data.watchingVoiceChannelId !== channelId) return;
  socket.leave(watchersKey(channelId));
  socket.data.watchingVoiceChannelId = undefined;
  socket.data.joinedVoiceWatchRoom = undefined;
}

/** Broadcasts screen share state so everyone in the room (and late joiners) can see who is sharing. */
export async function setSharing(io: Server, socketId: string, userId: string, sharing: boolean) {
  const socket = io.sockets.sockets.get(socketId);
  const channelId: string | undefined = socket?.data.voiceChannelId;
  if (!socket || !channelId) return false;
  if (sharing) await channelsService.canStream(channelId, userId);
  socket.data.sharing = sharing;
  logger.info(`voice: ${socket.data.username} ${sharing ? "started" : "stopped"} sharing in channel ${channelId}`);
  socket.to(roomKey(channelId)).emit(SOCKET_EVENTS.voiceScreen, { socketId, sharing });
  return true;
}

/** Only peers in the same room can signal each other. */
export function canSignal(io: Server, from: string, to: string) {
  const channelId = io.sockets.sockets.get(from)?.data.voiceChannelId;
  return Boolean(channelId) && io.sockets.sockets.get(to)?.data.voiceChannelId === channelId;
}
