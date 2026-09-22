import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS } from "../../lib/constants.js";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import * as channelsService from "../channels/channels.services.js";

/** `viewing`: socket id of the stream this peer is watching (one at a time), or null. */
export type Peer = { socketId: string; userId: string; username: string; sharing: boolean; viewing: string | null };

const toPeer = (socket: { id: string; data: Record<string, any> }): Peer => ({
  socketId: socket.id,
  userId: socket.data.userId,
  username: socket.data.username,
  sharing: Boolean(socket.data.sharing),
  viewing: socket.data.viewing ?? null,
});

const roomKey = (channelId: string) => `voice:${channelId}`;
const watchersKey = (channelId: string) => `voice-watchers:${channelId}`;

async function participants(io: Server, channelId: string): Promise<Peer[]> {
  return (await io.in(roomKey(channelId)).fetchSockets()).map(toPeer);
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

/**
 * canSpeak tells the client to stay muted. ponytail: in the P2P mesh nothing stops a modified
 * client from sending audio anyway — mediasoup will refuse the producer without SPEAK.
 */
export async function join(io: Server, socketId: string, userId: string, channelId: string) {
  const { canSpeak, canStream, userLimit } = await channelsService.canConnect(channelId, userId);
  const socket = io.sockets.sockets.get(socketId)!;
  if (socket.data.voiceChannelId) await leave(io, socketId);

  const peers = (await io.in(roomKey(channelId)).fetchSockets()).map(toPeer);
  if (peers.length >= userLimit) throw new HttpError(409, "Canal de voz lotado");

  socket.join(roomKey(channelId));
  socket.data.voiceChannelId = channelId;
  logger.info(`voice: ${socket.data.username} joined channel ${channelId} (${peers.length} already there)`);
  socket.to(roomKey(channelId)).emit(SOCKET_EVENTS.voicePeerJoined, {
    socketId,
    userId: socket.data.userId,
    username: socket.data.username,
    sharing: false,
    viewing: null,
  } satisfies Peer);
  await announceParticipants(io, channelId);

  return { peers, canSpeak, canStream };
}

export async function leave(io: Server, socketId: string) {
  const socket = io.sockets.sockets.get(socketId);
  const channelId: string | undefined = socket?.data.voiceChannelId;
  if (!socket || !channelId) return;
  socket.leave(roomKey(channelId));
  socket.data.voiceChannelId = undefined;
  stopViewing(io, socket);
  if (socket.data.sharing) {
    logger.info(`voice: ${socket.data.username} stopped sharing in channel ${channelId}`);
    dropViewers(io, socketId);
  }
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
  if (sharing) {
    await channelsService.canStream(channelId, userId);
    if (socket.data.viewing) throw new HttpError(409, "Leave the stream you are watching before sharing");
  } else {
    dropViewers(io, socketId);
  }
  socket.data.sharing = sharing;
  logger.info(`voice: ${socket.data.username} ${sharing ? "started" : "stopped"} sharing in channel ${channelId}`);
  socket.to(roomKey(channelId)).emit(SOCKET_EVENTS.voiceScreen, { socketId, sharing });
  await announceParticipants(io, channelId);
  return true;
}

/** Tells the streamer to start or stop sending its tab to this viewer. */
function notifyStreamer(io: Server, streamerId: string, viewerId: string, watching: boolean) {
  io.to(streamerId).emit(SOCKET_EVENTS.voiceViewer, { socketId: viewerId, watching });
}

function stopViewing(io: Server, viewer: Socket) {
  const streamerId: string | undefined = viewer.data.viewing;
  if (!streamerId) return false;
  viewer.data.viewing = undefined;
  notifyStreamer(io, streamerId, viewer.id, false);
  return true;
}

/** A stream that ended has no viewers left; they learn it from voice:screen. */
function dropViewers(io: Server, streamerId: string) {
  // ponytail: scans local sockets — with the Redis adapter this becomes a per-stream room.
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.viewing === streamerId) socket.data.viewing = undefined;
  }
}

/**
 * Opt-in viewing: the streamer only sends its tab to sockets that asked for it. One stream at a
 * time (watching another leaves the current one), and a sharer cannot watch.
 */
export async function watchStream(io: Server, viewerId: string, streamerId: string) {
  const viewer = io.sockets.sockets.get(viewerId);
  const channelId: string | undefined = viewer?.data.voiceChannelId;
  if (!viewer || !channelId) throw new HttpError(409, "Join a room first");
  if (viewer.data.sharing) throw new HttpError(409, "Stop sharing before watching a stream");
  const streamer = io.sockets.sockets.get(streamerId);
  if (
    !streamer ||
    streamerId === viewerId ||
    streamer.data.voiceChannelId !== channelId ||
    !streamer.data.sharing
  ) {
    throw new HttpError(404, "Stream not found");
  }
  if (viewer.data.viewing === streamerId) return;

  stopViewing(io, viewer);
  viewer.data.viewing = streamerId;
  notifyStreamer(io, streamerId, viewerId, true);
  logger.info(`voice: ${viewer.data.username} is watching ${streamer.data.username}`);
  await announceParticipants(io, channelId);
}

export async function unwatchStream(io: Server, viewerId: string) {
  const viewer = io.sockets.sockets.get(viewerId);
  if (!viewer || !stopViewing(io, viewer)) return;
  await announceParticipants(io, viewer.data.voiceChannelId);
}

/** Only peers in the same room can signal each other. */
export function canSignal(io: Server, from: string, to: string) {
  const channelId = io.sockets.sockets.get(from)?.data.voiceChannelId;
  return Boolean(channelId) && io.sockets.sockets.get(to)?.data.voiceChannelId === channelId;
}
