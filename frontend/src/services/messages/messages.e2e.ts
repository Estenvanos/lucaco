import { ENDPOINTS } from "../../constants/endpoints";
import { ApiError, request } from "../../lib/api";
import {
  createKeyPair,
  decryptKeyPair,
  decryptText,
  deriveChatKey,
  encryptPrivateKey,
  exportPublicKey,
  getStoredKeyPair,
  saveKeyPair,
} from "../../lib/crypto";
import type { AttachmentRef, AudioRef, ChatMessage, OwnKey, PublishedKey, StoredMessage } from "../../types/messages.types";
import { askPassword } from "./messages.key-prompt";

let published: Promise<CryptoKeyPair> | null = null;

/**
 * This browser's keypair, with the API holding its public half. Once per session.
 * Another browser restores the same keypair from the password-encrypted backup, so history
 * stays readable everywhere; without a backup it falls back to a key of its own.
 * ponytail: one key per user — a browser that skips the restore publishes its own key and the
 * others stop reading new messages; true multi-device needs per-device keys.
 */
export function myKeys(me: string) {
  published ??= resolveKeys(me).catch((err: unknown) => {
    published = null; // let the next call retry
    throw err;
  });
  return published;
}

async function resolveKeys(me: string) {
  const local = await getStoredKeyPair(me);
  const server = await request<OwnKey>(ENDPOINTS.users.keyBackup).catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
  const localPublic = local && (await exportPublicKey(local));

  if (local && server && localPublic === server.publicKey) {
    if (server.backup) return local;
    // Key from before backups (or the backup was skipped): it cannot be read out, so backing
    // it up means replacing it. Skipping keeps it.
    const upgraded = await askPassword("upgrade", (password) => publishNewKey(me, password)).catch(() => null);
    return upgraded ?? local;
  }

  if (server?.backup) {
    const { backup, publicKey } = server;
    const restored = await askPassword("restore", async (password) => {
      const pair = await decryptKeyPair(backup, publicKey, password);
      if (!pair) throw new ApiError(400, "Senha de recuperação incorreta");
      await saveKeyPair(me, pair);
      return pair;
    });
    if (restored) return restored;
  }

  // Nothing to restore (or the user gave up on it): this browser's key takes over, as before.
  if (local) {
    await request(ENDPOINTS.users.myKey, { method: "PUT", body: { publicKey: localPublic } });
    return local;
  }
  const created = await askPassword("create", (password) => publishNewKey(me, password)).catch(() => null);
  return created ?? publishNewKey(me, null);
}

/** A new keypair, published with its backup (none when `password` is null), then kept locally. */
async function publishNewKey(me: string, password: string | null) {
  const { pair, pkcs8 } = await createKeyPair();
  const backup = password === null ? undefined : await encryptPrivateKey(pkcs8, password);
  await request(ENDPOINTS.users.myKey, { method: "PUT", body: { publicKey: await exportPublicKey(pair), backup } });
  await saveKeyPair(me, pair);
  return pair;
}

const chatKeys = new Map<string, Promise<CryptoKey>>();

/** The AES key shared with `peerId`, derived once and kept in memory only. */
export function chatKey(me: string, peerId: string) {
  let key = chatKeys.get(peerId);
  if (!key) {
    key = (async () => {
      const pair = await myKeys(me);
      const peer = await request<PublishedKey>(ENDPOINTS.users.key(peerId)).catch((err: unknown) => {
        // The friend never opened a chat, so they have no key yet: nothing can be encrypted to them.
        if (err instanceof ApiError && err.status === 404) {
          throw new ApiError(404, "Seu amigo ainda não ativou as mensagens. Peça para ele abrir o Lucaco.");
        }
        throw err;
      });
      return deriveChatKey(pair.privateKey, peer.publicKey);
    })();
    key.catch(() => chatKeys.delete(peerId));
    chatKeys.set(peerId, key);
  }
  return key;
}

/** `key` null: no key opens it (an epoch this browser was never given). Shown as undecryptable. */
export async function decryptMessage(key: CryptoKey | null, message: StoredMessage): Promise<ChatMessage> {
  const plain = key && (await decryptText(key, message.ciphertext, message.iv));
  let audio: AudioRef | null = null;
  let attachment: AttachmentRef | null = null;
  if (plain && message.contentType !== "text") {
    try {
      const ref: unknown = JSON.parse(plain);
      if (message.contentType === "audio") audio = ref as AudioRef;
      else attachment = { ...(ref as AttachmentRef), kind: message.contentType };
    } catch {
      // stays null: shown as undecryptable
    }
  }
  return {
    id: message.id,
    senderId: message.senderId,
    text: audio || attachment ? "" : plain,
    audio,
    attachment,
    createdAt: message.createdAt,
  };
}
