import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import * as serversService from "../servers/servers.services.js";
import type { CreateChannelInput, UpdateChannelInput } from "./channels.schema.js";

export async function getById(channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new HttpError(404, "Channel not found");
  return channel;
}

export async function list(serverId: string, userId: string) {
  await serversService.requirePermission(serverId, userId, "VIEW_CHANNELS");
  return prisma.channel.findMany({
    where: { serverId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

export async function create(serverId: string, userId: string, input: CreateChannelInput) {
  await serversService.requirePermission(serverId, userId, "MANAGE_SERVER");
  return prisma.channel.create({
    data: {
      serverId,
      name: input.name,
      type: input.type,
      topic: input.topic ?? null,
      position: input.position ?? 0,
    },
  });
}

export async function update(channelId: string, userId: string, input: UpdateChannelInput) {
  const channel = await getById(channelId);
  await serversService.requirePermission(channel.serverId, userId, "MANAGE_SERVER");
  return prisma.channel.update({
    where: { id: channelId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.topic !== undefined && { topic: input.topic ?? null }),
      ...(input.position !== undefined && { position: input.position }),
    },
  });
}

export async function remove(channelId: string, userId: string) {
  const channel = await getById(channelId);
  await serversService.requirePermission(channel.serverId, userId, "MANAGE_SERVER");
  await prisma.channel.delete({ where: { id: channelId } });
  // ponytail: the channel's messages stay in Mongo. A jobs-module cleanup deletes them;
  // until then they are unreadable anyway (no member holds the channel key).
}

/** How other modules (messages, voice) ask whether a user may read a channel. */
export async function canView(channelId: string, userId: string) {
  const channel = await getById(channelId);
  await serversService.requirePermission(channel.serverId, userId, "VIEW_CHANNELS");
  return channel;
}

/** Sending needs VIEW_CHANNELS too: a member who cannot read the channel cannot write to it. */
export async function canSend(channelId: string, userId: string) {
  const channel = await canView(channelId, userId);
  if (channel.type !== "text") throw new HttpError(400, "Not a text channel");
  await serversService.requirePermission(channel.serverId, userId, "SEND_MESSAGES");
  return channel;
}
