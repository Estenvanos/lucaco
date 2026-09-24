import { createHash } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { HttpError } from "../../lib/http-error.js";
import type { NotificationTag } from "../../generated/prisma/client.js";
import { messages, type MessageDoc } from "../../lib/mongo.js";
import { NOTIFICATION_TAGS } from "../../lib/constants.js";
import { prisma } from "../../lib/prisma.js";
import { deleteObject } from "../../lib/storage.js";
import * as channelsService from "../channels/channels.services.js";
import * as friendsService from "../friends/friends.services.js";
import * as notificationsService from "../notifications/notifications.services.js";
import * as usersService from "../users/users.services.js";
import type {
  AddSharesInput,
  ChannelHistoryInput,
  CreateEpochInput,
  DeleteMessageInput,
  HistoryInput,
  ReactMessageInput,
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
    mentions: doc.mentions ?? { everyone: false, userIds: [] },
    answerFor: doc.answerFor ?? null,
    reactions: doc.reactions ?? [],
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
  ...("mentions" in input && { mentions: input.mentions }),
  ...(input.mediaId && { mediaId: input.mediaId }),
  ...(input.answerFor && { answerFor: input.answerFor }),
  createdAt: new Date(),
  expiresAt: null,
});

export async function send(userId: string, input: SendMessageInput) {
  const channelId = await requireFriendship(userId, input.peerId);
  await requireMedia(userId, channelId, input);
  const answered = await requireAnswer(channelId, input.answerFor);
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
    if (answered) await notifyAuthor(NOTIFICATION_TAGS.reply, userId, answered, "respondeu sua mensagem");
  }
  return message;
}

/**
 * A file message may only carry a file its sender uploaded for this very conversation, of the
 * kind the message says, that no other message uses (a retry of the same message is fine).
 */
async function requireMedia(
  userId: string,
  conversationId: string,
  input: SendMessageInput | SendChannelMessageInput,
) {
  if (!input.mediaId) return;
  const media = await prisma.mediaFile.findUnique({ where: { id: input.mediaId } });
  const kind = input.contentType === "audio" ? "voice" : input.contentType;
  if (media?.uploaderId !== userId || media.conversationId !== conversationId || media.kind !== kind) {
    throw new HttpError(400, "Invalid attachment");
  }
  const used = await messages.findOne({ mediaId: input.mediaId });
  if (used && !(used.senderId === userId && used.clientMessageId === input.clientMessageId)) {
    throw new HttpError(409, "Attachment already sent");
  }
}

/** A reply must point at a message of the same conversation. Returns that message. */
async function requireAnswer(conversationId: string, answerFor: string | undefined) {
  if (!answerFor) return null;
  const original = await messages.findOne({ _id: new ObjectId(answerFor), channelId: conversationId });
  if (!original) throw new HttpError(400, "Invalid reply");
  return original;
}

/**
 * Tells the author of `doc` that `userId` replied to or reacted on it. Never oneself. A channel
 * notice carries where it happened, so the bell can open the channel; a DM one opens the chat.
 */
async function notifyAuthor(tag: NotificationTag, userId: string, doc: MessageDoc, action: string) {
  if (doc.senderId === userId) return;
  const [sender, channel] = await Promise.all([
    usersService.getById(userId),
    doc.scope === "channel" ? channelsService.getById(doc.channelId) : null,
  ]);
  await notificationsService.notify({
    tag,
    title: sender.displayName ?? sender.username,
    subtitle: (channel ? `${action} em #${channel.name}` : action).slice(0, 120),
    ownerId: userId,
    receiverId: doc.senderId,
    ...(channel && { serverId: channel.serverId, channelId: channel.id }),
  });
}

/** The channel's newest key epoch, or null before anyone opened the chat. */
const latestEpoch = (channelId: string) =>
  prisma.channelKeyEpoch.findFirst({ where: { channelId }, orderBy: { epoch: "desc" } });

/**
 * A channel message must use the current epoch: after a rotation, the old key is what someone
 * who left still holds. Returns who to push it to (everyone who can read the channel now).
 */
export async function sendToChannel(userId: string, input: SendChannelMessageInput) {
  if (input.contentType === "text") await channelsService.canSend(input.channelId, userId);
  else if (input.contentType === "audio") await channelsService.canSendVoice(input.channelId, userId);
  else await channelsService.canAttach(input.channelId, userId);
  const latest = await latestEpoch(input.channelId);
  if (latest?.epoch !== input.keyEpoch) throw new HttpError(409, "Stale key epoch");
  await requireMedia(userId, input.channelId, input);
  const answered = await requireAnswer(input.channelId, input.answerFor);
  const { message, created } = await insertOnce(newDoc(userId, input.channelId, "channel", input, input.keyEpoch));
  const recipients = await channelsService.viewerIds(input.channelId);
  if (created) {
    await notifyMentions(userId, input, recipients);
    if (answered) await notifyAuthor(NOTIFICATION_TAGS.reply, userId, answered, "respondeu sua mensagem");
  }
  return { message, recipients };
}

/**
 * Only viewers of the channel can be pinged, so a made-up userId is ignored. Retries never get
 * here (`created`). ponytail: one row per target on @todos; batch it if servers get big.
 */
async function notifyMentions(userId: string, input: SendChannelMessageInput, viewers: string[]) {
  const { everyone, userIds } = input.mentions;
  const targets = (everyone ? viewers : userIds.filter((id) => viewers.includes(id))).filter((id) => id !== userId);
  if (targets.length === 0) return;
  const [sender, channel] = await Promise.all([usersService.getById(userId), channelsService.getById(input.channelId)]);
  const subtitle = `mencionou ${everyone ? "todos" : "você"} em #${channel.name}`.slice(0, 120);
  await Promise.all(
    [...new Set(targets)].map((receiverId) =>
      notificationsService.notify({
        tag: NOTIFICATION_TAGS.mention,
        title: sender.displayName ?? sender.username,
        subtitle,
        ownerId: userId,
        receiverId,
        serverId: channel.serverId,
        channelId: channel.id,
      }),
    ),
  );
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
 * Friends the user has already talked to, most recent first, each with its last message as
 * ciphertext: the client decrypts it for the preview, the server never reads it.
 */
export async function conversations(userId: string) {
  const friends = await friendsService.list(userId, { status: "accepted" });
  const byChannel = new Map(friends.map((f) => [dmId(userId, f.userId), f.user]));
  const last = await messages
    .aggregate<{ _id: string; last: MessageDoc }>([
      { $match: { channelId: { $in: [...byChannel.keys()] } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$channelId", last: { $first: "$$ROOT" } } },
      { $sort: { "last.createdAt": -1 } },
    ])
    .toArray();
  return last.map(({ _id, last }) => ({
    peer: byChannel.get(_id)!,
    lastMessageAt: last.createdAt,
    lastMessage: toPublicMessage(last),
  }));
}

/**
 * Who hears about a change to `doc`: both sides of a DM (the caller must be one of them, proven
 * by `peerId`), or everyone who can read the channel plus the caller.
 */
async function recipientsOf(userId: string, doc: MessageDoc, peerId: string | undefined) {
  if (doc.scope === "dm") {
    if (!peerId || dmId(userId, peerId) !== doc.channelId) throw new HttpError(400, "Wrong conversation");
    return [userId, peerId];
  }
  return [...new Set([userId, ...(await channelsService.viewerIds(doc.channelId))])];
}

/** Distinct emojis a message can carry, so reactions cannot grow the document without bound. */
const MAX_REACTION_EMOJIS = 20;

/**
 * One reaction per person: the same emoji again removes it, another emoji replaces it. Anyone who
 * can read the conversation may react; the author hears about a new one. Returns the new list and
 * who to tell.
 */
export async function react(userId: string, { messageId, emoji, peerId }: ReactMessageInput) {
  const doc = await messages.findOne({ _id: new ObjectId(messageId) });
  if (!doc) throw new HttpError(404, "Message not found");
  if (doc.scope === "channel") await channelsService.canView(doc.channelId, userId);
  const recipients = await recipientsOf(userId, doc, peerId);
  const reactions = doc.reactions ?? [];
  const mine = reactions.some((r) => r.emoji === emoji && r.userId === userId);
  const emojis = new Set(reactions.map((r) => r.emoji));
  if (!mine && !emojis.has(emoji) && emojis.size >= MAX_REACTION_EMOJIS) {
    throw new HttpError(409, "Too many reactions on this message");
  }
  // One pipeline update: drop whatever the caller had, then add the new one. Atomic, so two
  // people reacting at once cannot overwrite each other.
  const updated = await messages.findOneAndUpdate(
    { _id: doc._id },
    [
      {
        $set: {
          reactions: {
            $concatArrays: [
              { $filter: { input: { $ifNull: ["$reactions", []] }, cond: { $ne: ["$$this.userId", userId] } } },
              mine ? [] : [{ emoji, userId }],
            ],
          },
        },
      },
    ],
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(404, "Message not found"); // deleted in between
  if (!mine) await notifyAuthor(NOTIFICATION_TAGS.reaction, userId, doc, `reagiu com ${emoji} à sua mensagem`);
  return { id: messageId, channelId: doc.channelId, reactions: updated.reactions ?? [], recipients };
}

/**
 * Really deletes the message: the Mongo document, and its file (storage first, so a failure
 * leaves the message in place and a retry finishes the job). The author may always delete their
 * own message; in a channel, MANAGE_MESSAGES may delete anyone's. Returns who to tell: everyone
 * who can read the conversation, plus the author.
 */
export async function remove(userId: string, { messageId, peerId }: DeleteMessageInput) {
  const doc = await messages.findOne({ _id: new ObjectId(messageId) });
  if (!doc) throw new HttpError(404, "Message not found");
  if (doc.senderId !== userId) {
    if (doc.scope === "dm") throw new HttpError(403, "Only the author can delete a direct message");
    await channelsService.canManageMessages(doc.channelId, userId);
  }
  const recipients = await recipientsOf(userId, doc, peerId);
  if (doc.mediaId) {
    const media = await prisma.mediaFile.findUnique({ where: { id: doc.mediaId } });
    if (media) await Promise.all([media.storageKey, media.previewKey].filter((key): key is string => !!key).map((key) => deleteObject(key)));
  }
  await messages.deleteOne({ _id: doc._id });
  if (doc.mediaId) await prisma.mediaFile.deleteMany({ where: { id: doc.mediaId } });
  return { id: messageId, channelId: doc.channelId, recipients };
}

/** Opening the chat reads it: the peer's unread-message, reply and reaction notices go away. */
export async function markRead(userId: string, peerId: string) {
  const tags = [NOTIFICATION_TAGS.newMessage, NOTIFICATION_TAGS.reply, NOTIFICATION_TAGS.reaction];
  await Promise.all(tags.map((tag) => notificationsService.dismissFrom(userId, peerId, tag)));
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
