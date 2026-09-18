import { createHash } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { HttpError } from "../../lib/http-error.js";
import { messages, type MessageDoc } from "../../lib/mongo.js";
import { NOTIFICATION_TAGS } from "../../lib/constants.js";
import { prisma } from "../../lib/prisma.js";
import * as channelsService from "../channels/channels.services.js";
import * as friendsService from "../friends/friends.services.js";
import * as notificationsService from "../notifications/notifications.services.js";
import * as usersService from "../users/users.services.js";
import type {
  AddSharesInput,
  ChannelHistoryInput,
  CreateEpochInput,
  HistoryInput,
  SendChannelMessageInput,
  SendMessageInput,
} from "./messages.schema.js";

/** Fixed namespace for the DM conversation ids derived below. Changing it orphans every DM. */
const DM_NAMESPACE = "6f1b2e34-9a6f-4c1e-8f7a-2b1c9d0e4a55";

/** UUIDv5 (sha1) of `name` inside `namespace`, per RFC 4122. Avoids a uuid dependency. */
function uuidv5(name: string, namespace: string) {
  const bytes = createHash("sha1")
    .update(Buffer.from(namespace.replaceAll("-", ""), "hex"))
    .update(name)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * A DM has no row of its own: its id is derived from the canonical pair, so both sides compute
 * the same conversation id without a lookup. Mirrors friendships' canonical order.
 */
export function dmId(a: string, b: string) {
  const { userLowId, userHighId } = friendsService.canonicalPair(a, b);
  return uuidv5(`${userLowId}:${userHighId}`, DM_NAMESPACE);
}

export function toPublicMessage(doc: MessageDoc) {
  return {
    id: doc._id.toHexString(),
    channelId: doc.channelId,
    scope: doc.scope,
    senderId: doc.senderId,
    clientMessageId: doc.clientMessageId,
    contentType: doc.contentType,
    ciphertext: doc.ciphertext,
    iv: doc.iv,
    keyEpoch: doc.keyEpoch,
    createdAt: doc.createdAt,
  };
}

/** DMs are only allowed between accepted friends, which also covers blocked pairs. */
async function requireFriendship(userId: string, peerId: string) {
  if (!(await friendsService.areFriends(userId, peerId)))
    throw new HttpError(403, "You can only message friends");
  return dmId(userId, peerId);
}

/**
 * Stores the ciphertext as-is: the server never sees the plaintext, the key or the IV's meaning.
 * A retry with the same clientMessageId returns the stored message instead of a duplicate,
 * which is what makes a reconnect safe to replay. `created` is false on such a retry.
 */
async function insertOnce(doc: MessageDoc) {
  try {
    await messages.insertOne(doc);
    return { message: toPublicMessage(doc), created: true };
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      const existing = await messages.findOne({ senderId: doc.senderId, clientMessageId: doc.clientMessageId });
      if (existing) return { message: toPublicMessage(existing), created: false };
    }
    throw err;
  }
}

const newDoc = (
  userId: string,
  channelId: string,
  scope: MessageDoc["scope"],
  input: SendMessageInput | SendChannelMessageInput,
  keyEpoch: number | null,
): MessageDoc => ({
  _id: new ObjectId(),
  channelId,
  scope,
  senderId: userId,
  clientMessageId: input.clientMessageId,
  contentType: input.contentType,
  ciphertext: input.ciphertext,
  iv: input.iv,
  keyEpoch,
  createdAt: new Date(),
  expiresAt: null,
});

export async function send(userId: string, input: SendMessageInput) {
  const channelId = await requireFriendship(userId, input.peerId);
  const { message, created } = await insertOnce(newDoc(userId, channelId, "dm", input, null));
  // Only a new message notifies: an idempotent retry must not ping twice.
  if (created) {
    const sender = await usersService.getById(userId);
    await notificationsService.notifyOnce({
      tag: NOTIFICATION_TAGS.newMessage,
      title: `${sender.displayName ?? sender.username} te mandou uma mensagem`,
      ownerId: userId,
      receiverId: input.peerId,
    });
  }
  return message;
}

/** The channel's newest key epoch, or null before anyone opened the chat. */
const latestEpoch = (channelId: string) =>
  prisma.channelKeyEpoch.findFirst({ where: { channelId }, orderBy: { epoch: "desc" } });

/**
 * A channel message must use the current epoch: after a rotation, the old key is what someone
 * who left still holds. Returns who to push it to (everyone who can read the channel now).
 */
export async function sendToChannel(userId: string, input: SendChannelMessageInput) {
  if (input.contentType === "audio") await channelsService.canSendVoice(input.channelId, userId);
  else await channelsService.canSend(input.channelId, userId);
  const latest = await latestEpoch(input.channelId);
  if (latest?.epoch !== input.keyEpoch) throw new HttpError(409, "Stale key epoch");
  const { message } = await insertOnce(newDoc(userId, input.channelId, "channel", input, input.keyEpoch));
  return { message, recipients: await channelsService.viewerIds(input.channelId) };
}

async function page(channelId: string, before: string | undefined, limit: number) {
  const rows = await messages
    .find({ channelId, ...(before && { _id: { $lt: new ObjectId(before) } }) })
    .sort({ _id: -1 })
    .limit(limit + 1) // one extra row answers hasMore without a count
    .toArray();

  const items = rows.slice(0, limit);
  return {
    channelId,
    messages: items.map(toPublicMessage),
    hasMore: rows.length > limit,
    nextCursor: rows.length > limit ? items.at(-1)!._id.toHexString() : null,
  };
}

/** Newest first, one page at a time, walking backwards from `before`. */
export async function history(userId: string, { peerId, before, limit }: HistoryInput) {
  return page(await requireFriendship(userId, peerId), before, limit);
}

export async function channelHistory(userId: string, { channelId, before, limit }: ChannelHistoryInput) {
  await channelsService.canView(channelId, userId);
  return page(channelId, before, limit);
}

/**
 * Friends the user has already talked to, most recent first. Only the time of the last message:
 * the content is ciphertext, so there is no preview to give.
 */
export async function conversations(userId: string) {
  const friends = await friendsService.list(userId, { status: "accepted" });
  const byChannel = new Map(friends.map((f) => [dmId(userId, f.userId), f.user]));
  const last = await messages
    .aggregate<{ _id: string; lastMessageAt: Date }>([
      { $match: { channelId: { $in: [...byChannel.keys()] } } },
      { $group: { _id: "$channelId", lastMessageAt: { $max: "$createdAt" } } },
      { $sort: { lastMessageAt: -1 } },
    ])
    .toArray();
  return last.map(({ _id, lastMessageAt }) => ({ peer: byChannel.get(_id)!, lastMessageAt }));
}

/** Opening the chat reads it: the peer's unread-message notice goes away. */
export function markRead(userId: string, peerId: string) {
  return notificationsService.dismissFrom(userId, peerId, NOTIFICATION_TAGS.newMessage);
}

/** Typing is relayed only between friends, same rule as the messages themselves. */
export function typing(userId: string, peerId: string) {
  return requireFriendship(userId, peerId);
}

/**
 * What the browser needs to read and keep the channel readable (arquitetura-lucaco.md 7.2):
 * - `shares`: the caller's wrapped key for every epoch they were given;
 * - `recipients`: every viewer with a published key, and whether they hold the current epoch's
 *   key; a new epoch is wrapped for all of them, the caller fills in the ones without it;
 * - `rotate`: someone who holds the current key can no longer see the channel, so the next
 *   writer must start a new epoch.
 */
export async function channelKeys(channelId: string, userId: string) {
  await channelsService.canView(channelId, userId);
  const [mine, latest, viewers] = await Promise.all([
    prisma.channelKeyShare.findMany({
      where: { recipientId: userId, epoch: { channelId } },
      include: { epoch: { select: { epoch: true } } },
    }),
    prisma.channelKeyEpoch.findFirst({
      where: { channelId },
      orderBy: { epoch: "desc" },
      include: { shares: { select: { recipientId: true } } },
    }),
    channelsService.viewerIds(channelId),
  ]);
  const holders = new Set(latest?.shares.map((s) => s.recipientId));
  return {
    latest: latest?.epoch ?? 0,
    shares: mine
      .map((s) => ({ epoch: s.epoch.epoch, encryptedKey: s.encryptedKey, iv: s.iv, wrapperPublicKey: s.wrapperPublicKey }))
      .sort((a, b) => a.epoch - b.epoch),
    recipients: (await usersService.getActiveKeys(viewers)).map((k) => ({ ...k, hasShare: holders.has(k.userId) })),
    rotate: [...holders].some((id) => !viewers.includes(id)),
  };
}

/** Shares may only go to people who can read the channel right now. */
async function requireViewers(channelId: string, recipientIds: string[]) {
  const viewers = await channelsService.viewerIds(channelId);
  if (recipientIds.some((id) => !viewers.includes(id))) {
    throw new HttpError(403, "A recipient cannot view this channel");
  }
}

/**
 * Starts epoch `latest + 1`. The wrapper's public key is taken from the directory, not the body,
 * so recipients always derive the unwrap key from the key the caller really published.
 */
export async function createEpoch(channelId: string, userId: string, { epoch, shares }: CreateEpochInput) {
  await channelsService.canView(channelId, userId);
  const latest = await latestEpoch(channelId);
  if (epoch !== (latest?.epoch ?? 0) + 1) throw new HttpError(409, "Stale key epoch");
  if (!shares.some((s) => s.recipientId === userId)) throw new HttpError(400, "Include your own share");
  await requireViewers(channelId, shares.map((s) => s.recipientId));
  const { publicKey } = await usersService.getActiveKey(userId);
  try {
    await prisma.channelKeyEpoch.create({
      data: {
        channelId,
        epoch,
        createdBy: userId,
        shares: { create: shares.map((s) => ({ ...s, wrappedBy: userId, wrapperPublicKey: publicKey })) },
      },
    });
  } catch (err) {
    // Two members rotating at once: the unique (channel_id, epoch) lets exactly one win.
    if ((err as { code?: string }).code === "P2002") throw new HttpError(409, "Stale key epoch");
    throw err;
  }
  return { epoch };
}

/** Hands the current key to viewers who lack it. Only someone who holds it can hand it out. */
export async function addShares(channelId: string, epoch: number, userId: string, { shares }: AddSharesInput) {
  await channelsService.canView(channelId, userId);
  const latest = await latestEpoch(channelId);
  if (latest?.epoch !== epoch) throw new HttpError(409, "Stale key epoch");
  const own = await prisma.channelKeyShare.findUnique({
    where: { epochId_recipientId: { epochId: latest.id, recipientId: userId } },
  });
  if (!own) throw new HttpError(403, "You do not hold this epoch's key");
  await requireViewers(channelId, shares.map((s) => s.recipientId));
  const { publicKey } = await usersService.getActiveKey(userId);
  await prisma.channelKeyShare.createMany({
    data: shares.map((s) => ({ ...s, epochId: latest.id, wrappedBy: userId, wrapperPublicKey: publicKey })),
    skipDuplicates: true, // someone else may have shared first
  });
}
