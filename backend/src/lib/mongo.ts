import { MongoClient, type Collection, type ObjectId } from "mongodb";
import { env } from "../env.js";

/**
 * Messages live in MongoDB, not Postgres: they are append-only documents read by cursor,
 * and the server only ever holds opaque ciphertext (see arquitetura-lucaco.md section 6).
 * One collection serves DMs and server channels; `scope` tells them apart.
 */
export type MessageDoc = {
  _id: ObjectId;
  channelId: string; // text channel id, or the derived DM conversation id
  scope: "dm" | "channel";
  senderId: string;
  clientMessageId: string;
  contentType: "text";
  ciphertext: string; // base64, AES-GCM
  iv: string; // base64, random per message
  keyEpoch: number | null; // which sender key decrypts it; null for DMs
  createdAt: Date;
  expiresAt: Date | null;
};

const client = new MongoClient(env.MONGO_URL);

export const messages = client.db().collection<MessageDoc>("messages");

export async function connectMongo() {
  await client.connect();
  await client.db().command({ ping: 1 });
}

export function ensureMessageIndexes() {
  return messages.createIndexes([
    { key: { channelId: 1, _id: -1 } }, // cursor pagination
    { key: { senderId: 1, clientMessageId: 1 }, unique: true }, // idempotent retries
    { key: { channelId: 1, keyEpoch: 1 } }, // key rotation lookups
    { key: { expiresAt: 1 }, expireAfterSeconds: 0 }, // ephemeral messages
  ]);
}

export const closeMongo = () => client.close();
