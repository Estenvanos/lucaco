import type { Request, Response } from "express";
import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS } from "../../lib/constants.js";
import { userRoom } from "../../lib/socket.js";
import {
  addSharesSchema,
  channelHistorySchema,
  channelParamsSchema,
  createEpochSchema,
  deleteMessageSchema,
  epochParamsSchema,
  historySchema,
  peerSchema,
  sendChannelMessageSchema,
  sendMessageSchema,
} from "./messages.schema.js";
import * as messagesService from "./messages.services.js";

/**
 * GET /messages?peerId=&before=&limit= (DM) or ?channelId=... (server channel) — the page of
 * older messages the socket does not carry.
 */
export async function history(req: Request, res: Response) {
  const userId = req.auth!.sub;
  res.json(
    "channelId" in req.query
      ? await messagesService.channelHistory(userId, channelHistorySchema.parse(req.query))
      : await messagesService.history(userId, historySchema.parse(req.query)),
  );
}

export async function conversations(req: Request, res: Response) {
  res.json(await messagesService.conversations(req.auth!.sub));
}

/**
 * Socket handler: the ack carries the stored message. A DM goes to both sides, a channel message
 * to every member who can read the channel.
 */
export async function send(io: Server, socket: Socket, payload: unknown) {
  if (payload && typeof payload === "object" && "channelId" in payload) {
    const { message, recipients } = await messagesService.sendToChannel(
      socket.data.userId,
      sendChannelMessageSchema.parse(payload),
    );
    io.to(recipients.map(userRoom)).emit(SOCKET_EVENTS.messageNew, message);
    return message;
  }
  const input = sendMessageSchema.parse(payload);
  const message = await messagesService.send(socket.data.userId, input);
  io.to(userRoom(input.peerId)).to(userRoom(socket.data.userId)).emit(SOCKET_EVENTS.messageNew, message);
  return message;
}

/** Socket handler: deletes a message and tells everyone who could read it. */
export async function remove(io: Server, socket: Socket, payload: unknown) {
  const { id, channelId, recipients } = await messagesService.remove(
    socket.data.userId,
    deleteMessageSchema.parse(payload),
  );
  io.to(recipients.map(userRoom)).emit(SOCKET_EVENTS.messageDeleted, { id, channelId });
  return { id };
}

/** POST /messages/read { peerId } */
export async function markRead(req: Request, res: Response) {
  const { peerId } = peerSchema.parse(req.body);
  await messagesService.markRead(req.auth!.sub, peerId);
  res.status(204).end();
}

/** Socket handler: tells the peer "typing now". The client repeats it while the user types. */
export async function typing(io: Server, socket: Socket, payload: unknown) {
  const { peerId } = peerSchema.parse(payload);
  await messagesService.typing(socket.data.userId, peerId);
  io.to(userRoom(peerId)).emit(SOCKET_EVENTS.messageTyping, { userId: socket.data.userId });
  return {};
}

export async function channelKeys(req: Request, res: Response) {
  const { channelId } = channelParamsSchema.parse(req.params);
  res.json(await messagesService.channelKeys(channelId, req.auth!.sub));
}

export async function createEpoch(req: Request, res: Response) {
  const { channelId } = channelParamsSchema.parse(req.params);
  res.status(201).json(await messagesService.createEpoch(channelId, req.auth!.sub, createEpochSchema.parse(req.body)));
}

export async function addShares(req: Request, res: Response) {
  const { channelId, epoch } = epochParamsSchema.parse(req.params);
  await messagesService.addShares(channelId, epoch, req.auth!.sub, addSharesSchema.parse(req.body));
  res.status(204).end();
}
