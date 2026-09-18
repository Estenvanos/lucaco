/**
 * E2E primitives, Web Crypto only (arquitetura-lucaco.md §7): ECDH P-256 to agree on a secret,
 * HKDF-SHA-256 to turn it into an AES-GCM 256 key, a fresh random IV per message. The private
 * key is a non-extractable CryptoKey kept in IndexedDB: script can use it, never read it out.
 */

const DB_NAME = "lucaco-e2e";
const STORE = "keys";
const HKDF_INFO = new TextEncoder().encode("lucaco-dm-v1");

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

/** This browser's keypair for `userId`, created on first use. */
export async function loadKeyPair(userId: string) {
  const stored = await idb<CryptoKeyPair | undefined>("readonly", (s) => s.get(userId));
  if (stored) return stored;
  // extractable=false applies to the private key; the public half is always exportable.
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  await idb("readwrite", (s) => s.put(pair, userId));
  return pair;
}

/** SPKI, base64: the format `PUT /users/me/keys` takes. */
export async function exportPublicKey(pair: CryptoKeyPair) {
  return toBase64(await crypto.subtle.exportKey("spki", pair.publicKey));
}

/** Both sides get the same key: ECDH(my private, their public) == ECDH(their private, my public). */
export async function deriveChatKey(myPrivate: CryptoKey, peerPublicBase64: string) {
  const peerPublic = await crypto.subtle.importKey(
    "spki", fromBase64(peerPublicBase64), { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: peerPublic }, myPrivate, 256);
  const hkdf = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: HKDF_INFO },
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
