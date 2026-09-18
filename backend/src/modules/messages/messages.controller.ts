import type { Request, Response } from "express";
import type { Server, Socket } from "socket.io";
import { SOCKET_EVENTS } from "../../lib/constants.js";
import { userRoom } from "../../lib/socket.js";
import { historySchema, peerSchema, sendMessageSchema } from "./messages.schema.js";
import * as messagesService from "./messages.services.js";

/** GET /messages?peerId=&before=&limit= — the page of older messages the socket does not carry. */
export async function history(req: Request, res: Response) {
  res.json(await messagesService.history(req.auth!.sub, historySchema.parse(req.query)));
}

export async function conversations(req: Request, res: Response) {
  res.json(await messagesService.conversations(req.auth!.sub));
}

/** Socket handler: the ack carries the stored message, both sides get `message:new`. */
export async function send(io: Server, socket: Socket, payload: unknown) {
  const input = sendMessageSchema.parse(payload);
  const message = await messagesService.send(socket.data.userId, input);
  io.to(userRoom(input.peerId)).to(userRoom(socket.data.userId)).emit(SOCKET_EVENTS.messageNew, message);
  return message;
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
