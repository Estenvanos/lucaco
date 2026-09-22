/**
 * E2E primitives, Web Crypto only (arquitetura-lucaco.md §7): ECDH P-256 to agree on a secret,
 * HKDF-SHA-256 to turn it into an AES-GCM 256 key, a fresh random IV per message. The private
 * key is a non-extractable CryptoKey kept in IndexedDB: script can use it, never read it out.
 * The one readable copy is the PKCS8 export at creation, encrypted under a recovery password
 * (PBKDF2) and parked on the API so another browser can restore the same keypair.
 */

import type { KeyBackup } from "../types/messages.types";

const DB_NAME = "lucaco-e2e";
const STORE = "keys";
const DM_INFO = "lucaco-dm-v1";
/** Separate HKDF label: the key that wraps channel keys is never the DM key of the same pair. */
const WRAP_INFO = "lucaco-channel-wrap-v1";
const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
/** OWASP 2023 figure for PBKDF2-SHA256: the backup sits on the server, open to offline guessing. */
const PBKDF2_ITERATIONS = 600_000;

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** One IndexedDB request as a promise. The store is a plain key -> CryptoKeyPair map. */
function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = run(open.result.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    };
  });
}

/** This browser's keypair for `userId`, if it has one. */
export const getStoredKeyPair = (userId: string) =>
  idb<CryptoKeyPair | undefined>("readonly", (s) => s.get(userId));

export const saveKeyPair = (userId: string, pair: CryptoKeyPair) => idb("readwrite", (s) => s.put(pair, userId));

const importPrivateKey = (pkcs8: BufferSource) => crypto.subtle.importKey("pkcs8", pkcs8, ECDH, false, ["deriveBits"]);

/**
 * A fresh keypair plus its private half as PKCS8, readable only here: the pair returned (and
 * stored) holds a non-extractable re-import, so the key cannot be read out afterwards.
 */
export async function createKeyPair() {
  const fresh = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", fresh.privateKey);
  const pair: CryptoKeyPair = { publicKey: fresh.publicKey, privateKey: await importPrivateKey(pkcs8) };
  return { pair, pkcs8 };
}

async function passwordKey(password: string, salt: BufferSource) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** The private key sealed under the recovery password: the shape `PUT /users/me/keys` takes as `backup`. */
export async function encryptPrivateKey(pkcs8: ArrayBuffer, password: string): Promise<KeyBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { data, iv } = await encryptBytes(await passwordKey(password, salt), pkcs8);
  return { encryptedPrivateKey: toBase64(data), salt: toBase64(salt), iv };
}

/** The backed-up keypair, or null on a wrong password (GCM refuses instead of returning junk). */
export async function decryptKeyPair(backup: KeyBackup, publicKey: string, password: string) {
  const key = await passwordKey(password, fromBase64(backup.salt));
  const pkcs8 = await decryptBytes(key, fromBase64(backup.encryptedPrivateKey), backup.iv);
  if (!pkcs8) return null;
  const pair: CryptoKeyPair = {
    publicKey: await crypto.subtle.importKey("spki", fromBase64(publicKey), ECDH, true, []),
    privateKey: await importPrivateKey(pkcs8),
  };
  return pair;
}

/** SPKI, base64: the format `PUT /users/me/keys` takes. */
export async function exportPublicKey(pair: CryptoKeyPair) {
  return toBase64(await crypto.subtle.exportKey("spki", pair.publicKey));
}

/** Both sides get the same key: ECDH(my private, their public) == ECDH(their private, my public). */
export const deriveChatKey = (myPrivate: CryptoKey, peerPublicBase64: string) =>
  derivePairKey(myPrivate, peerPublicBase64, DM_INFO);

async function derivePairKey(myPrivate: CryptoKey, peerPublicBase64: string, info: string) {
  const peerPublic = await crypto.subtle.importKey(
    "spki", fromBase64(peerPublicBase64), { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: peerPublic }, myPrivate, 256);
  const hkdf = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode(info) },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(key: CryptoKey, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { ciphertext: toBase64(data), iv: toBase64(iv) };
}

/** null when it does not decrypt (other key, tampered): GCM authenticates, it never returns junk. */
export async function decryptText(key: CryptoKey, ciphertext: string, iv: string) {
  try {
    const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(ciphertext));
    return new TextDecoder().decode(data);
  } catch {
    return null;
  }
}

/** Bytes in, bytes out: files (voice messages) are encrypted like text, IV random per file. */
export async function encryptBytes(key: CryptoKey, data: ArrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { data: await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data), iv: toBase64(iv) };
}

export async function decryptBytes(key: CryptoKey, data: BufferSource, iv: string) {
  try {
    return await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, data);
  } catch {
    return null;
  }
}

/**
 * A fresh AES key: a channel epoch key (arquitetura-lucaco.md 7.2) or a one-file key. Extractable
 * because it is handed to others wrapped (or inside the message); it only lives in memory.
 */
export const generateKey = () =>
  crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

export const exportKey = async (key: CryptoKey) => toBase64(await crypto.subtle.exportKey("raw", key));

export const importKey = (raw: string) =>
  crypto.subtle.importKey("raw", fromBase64(raw), "AES-GCM", true, ["encrypt", "decrypt"]);

/** The key encrypted for one member: only ECDH(their private, my public) opens it. */
export async function wrapKey(myPrivate: CryptoKey, recipientPublic: string, key: CryptoKey) {
  const wrapping = await derivePairKey(myPrivate, recipientPublic, WRAP_INFO);
  const { ciphertext, iv } = await encryptText(wrapping, await exportKey(key));
  return { encryptedKey: ciphertext, iv };
}

/** null when it does not open (wrapped for another key of mine, tampered). */
export async function unwrapKey(myPrivate: CryptoKey, wrapperPublic: string, encryptedKey: string, iv: string) {
  const wrapping = await derivePairKey(myPrivate, wrapperPublic, WRAP_INFO);
  const raw = await decryptText(wrapping, encryptedKey, iv);
  return raw === null ? null : importKey(raw);
}
