import { createHash } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { HttpError } from "../../lib/http-error.js";
import { messages, type MessageDoc } from "../../lib/mongo.js";
import * as friendsService from "../friends/friends.services.js";
import type { HistoryInput, SendMessageInput } from "./messages.schema.js";

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
 * which is what makes a reconnect safe to replay.
 */
export async function send(userId: string, input: SendMessageInput) {
  const channelId = await requireFriendship(userId, input.peerId);
  const doc: MessageDoc = {
    _id: new ObjectId(),
    channelId,
    scope: "dm",
    senderId: userId,
    clientMessageId: input.clientMessageId,
    contentType: input.contentType,
    ciphertext: input.ciphertext,
    iv: input.iv,
    keyEpoch: null,
    createdAt: new Date(),
    expiresAt: null,
  };

  try {
    await messages.insertOne(doc);
    return toPublicMessage(doc);
  } catch (err) {
    if (err instanceof MongoServerError && err.code === 11000) {
      const existing = await messages.findOne({
        senderId: userId,
        clientMessageId: input.clientMessageId,
      });
      if (existing) return toPublicMessage(existing);
    }
    throw err;
  }
}

/** Newest first, one page at a time, walking backwards from `before`. */
export async function history(userId: string, { peerId, before, limit }: HistoryInput) {
  const channelId = await requireFriendship(userId, peerId);
  const page = await messages
    .find({ channelId, ...(before && { _id: { $lt: new ObjectId(before) } }) })
    .sort({ _id: -1 })
    .limit(limit + 1) // one extra row answers hasMore without a count
    .toArray();

  const items = page.slice(0, limit);
  return {
    channelId,
    messages: items.map(toPublicMessage),
    hasMore: page.length > limit,
    nextCursor: page.length > limit ? items.at(-1)!._id.toHexString() : null,
  };
}
