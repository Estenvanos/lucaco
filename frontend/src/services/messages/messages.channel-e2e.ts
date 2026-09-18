import { ENDPOINTS } from "../../constants/endpoints";
import { ApiError, request } from "../../lib/api";
import { generateKey, unwrapKey, wrapKey } from "../../lib/crypto";
import type { ChannelKeysResponse, Keyring } from "../../types/messages.types";
import { myKeys } from "./messages.e2e";

const keyrings = new Map<string, Promise<Keyring>>();

/**
 * Sender keys for a server text channel (arquitetura-lucaco.md 7.2). Opens every epoch key this
 * user was given, then keeps the channel readable for everyone:
 * - no epoch yet, someone who left still holds the key (`rotate`), or I was never given the
 *   current key: start the next epoch, wrapped for every viewer;
 * - otherwise hand the current key to viewers who lack it.
 * A newcomer therefore reads from the epoch they joined in on, not the history before it.
 */
async function load(me: string, channelId: string, attempt = 0): Promise<Keyring> {
  const pair = await myKeys(me);
  const data = await request<ChannelKeysResponse>(ENDPOINTS.messages.channelKeys(channelId));
  const keys = new Map<number, CryptoKey>();
  for (const share of data.shares) {
    const key = await unwrapKey(pair.privateKey, share.wrapperPublicKey, share.encryptedKey, share.iv);
    if (key) keys.set(share.epoch, key);
  }

  if (data.latest === 0 || data.rotate || !keys.has(data.latest)) {
    const epoch = data.latest + 1;
    const key = await generateKey();
    const shares = await Promise.all(
      data.recipients.map(async (r) => ({ recipientId: r.userId, ...(await wrapKey(pair.privateKey, r.publicKey, key)) })),
    );
    try {
      await request(ENDPOINTS.messages.channelKeys(channelId), { method: "POST", body: { epoch, shares } });
    } catch (err) {
      // Someone else rotated first: their epoch has a share for me, so read again.
      if (err instanceof ApiError && err.status === 409 && attempt < 2) return load(me, channelId, attempt + 1);
      throw err;
    }
    keys.set(epoch, key);
    return { keys, current: epoch };
  }

  const current = keys.get(data.latest)!;
  const missing = data.recipients.filter((r) => !r.hasShare);
  if (missing.length) {
    // Best effort: whoever opens the channel next with the key tries again.
    void Promise.all(
      missing.map(async (r) => ({ recipientId: r.userId, ...(await wrapKey(pair.privateKey, r.publicKey, current)) })),
    )
      .then((shares) =>
        request(ENDPOINTS.messages.channelShares(channelId, data.latest), { method: "POST", body: { shares } }),
      )
      .catch(() => {});
  }
  return { keys, current: data.latest };
}

/** The channel's keyring, loaded once per page load. `fresh` drops the cached one first. */
export function channelKeyring(me: string, channelId: string, fresh = false) {
  let ring = fresh ? undefined : keyrings.get(channelId);
  if (!ring) {
    ring = load(me, channelId);
    ring.catch(() => keyrings.delete(channelId));
    keyrings.set(channelId, ring);
  }
  return ring;
}

/** The key for a message's epoch; an unknown epoch means a rotation happened: reload once. */
export async function keyForEpoch(me: string, channelId: string, epoch: number | null) {
  if (epoch === null) return null;
  const ring = await channelKeyring(me, channelId);
  if (ring.keys.has(epoch)) return ring.keys.get(epoch)!;
  if (epoch <= ring.current) return null;
  return (await channelKeyring(me, channelId, true)).keys.get(epoch) ?? null;
}
