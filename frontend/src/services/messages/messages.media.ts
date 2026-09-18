import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { request } from "../../lib/api";
import { decryptBytes, encryptBytes, exportKey, generateKey, importKey } from "../../lib/crypto";
import type { AudioRef, MediaTarget } from "../../types/messages.types";
import { messagesKeys } from "./messages.keys";

/**
 * Encrypts a recording with a key of its own and uploads the ciphertext. The returned reference
 * (media id + key + IV) is what the E2E message carries, so only its readers can play it.
 */
export async function uploadVoice(target: MediaTarget, recording: Blob, durationMs: number): Promise<AudioRef> {
  const key = await generateKey();
  const { data, iv } = await encryptBytes(key, await recording.arrayBuffer());
  const body = new FormData();
  for (const [field, value] of Object.entries(target)) body.append(field, value);
  body.append("file", new Blob([data], { type: "application/octet-stream" }), "voice");
  const { id } = await request<{ id: string }>(ENDPOINTS.media.root, { method: "POST", body });
  return { mediaId: id, key: await exportKey(key), iv, mime: recording.type, durationMs };
}

/**
 * Downloads, decrypts and hands back a playable object URL.
 * ponytail: the URL is never revoked (gcTime Infinity keeps one per message for the page's life);
 * revoke on query removal if long sessions pile up memory.
 */
export const useVoiceMessage = (audio: AudioRef) =>
  useQuery({
    queryKey: messagesKeys.audio(audio.mediaId),
    queryFn: async () => {
      const { url } = await request<{ url: string }>(ENDPOINTS.media.detail(audio.mediaId));
      const res = await fetch(url);
      if (!res.ok) throw new Error("Áudio indisponível");
      const plain = await decryptBytes(await importKey(audio.key), await res.arrayBuffer(), audio.iv);
      if (!plain) throw new Error("Não foi possível decifrar o áudio");
      return URL.createObjectURL(new Blob([plain], { type: audio.mime }));
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
