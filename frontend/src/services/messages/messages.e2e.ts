import { ENDPOINTS } from "../../constants/endpoints";
import { ApiError, request } from "../../lib/api";
import { decryptText, deriveChatKey, exportPublicKey, loadKeyPair } from "../../lib/crypto";
import type { AudioRef, ChatMessage, PublishedKey, StoredMessage } from "../../types/messages.types";

let published: Promise<CryptoKeyPair> | null = null;

/**
 * Loads this browser's keypair and makes sure the API has its public half. Once per session.
 * ponytail: one device per user — a second browser publishes its own key and the first can no
 * longer read new messages (and republishes on its next load); multi-device needs per-device keys.
 */
export function myKeys(me: string) {
  published ??= (async () => {
    const pair = await loadKeyPair(me);
    const publicKey = await exportPublicKey(pair);
    const current = await request<PublishedKey>(ENDPOINTS.users.key(me)).catch((err: unknown) => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    });
    if (current?.publicKey !== publicKey) {
      await request(ENDPOINTS.users.myKey, { method: "PUT", body: { publicKey } });
    }
    return pair;
  })().catch((err: unknown) => {
    published = null; // let the next call retry
    throw err;
  });
  return published;
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
  if (plain && message.contentType === "audio") {
    try {
      audio = JSON.parse(plain) as AudioRef;
    } catch {
      audio = null;
    }
  }
  return {
    id: message.id,
    senderId: message.senderId,
    text: audio ? "" : plain,
    audio,
    createdAt: message.createdAt,
  };
}
