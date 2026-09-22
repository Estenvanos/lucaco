import { useQuery } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { LIMITS } from "../../constants/limits";
import { ApiError, request } from "../../lib/api";
import { decryptBytes, encryptBytes, exportKey, generateKey, importKey } from "../../lib/crypto";
import type { AttachmentKind, AttachmentRef, AudioRef, MediaTarget } from "../../types/messages.types";
import { messagesKeys } from "./messages.keys";

/**
 * Encrypts a recording with a key of its own and uploads the ciphertext. The returned reference
 * (media id + key + IV) is what the E2E message carries, so only its readers can play it.
 */
export async function uploadVoice(target: MediaTarget, recording: Blob, durationMs: number): Promise<AudioRef> {
  const key = await generateKey();
  const { data, iv } = await encryptBytes(key, await recording.arrayBuffer());
  const { id } = await upload(target, "voice", new Blob([data], { type: "application/octet-stream" }), "voice");
  return { mediaId: id, key: await exportKey(key), iv, mime: recording.type, durationMs };
}

const upload = (target: MediaTarget, kind: "voice" | AttachmentKind, file: Blob, name: string) => {
  const body = new FormData();
  for (const [field, value] of Object.entries(target)) body.append(field, value);
  body.append("kind", kind);
  body.append("file", file, name);
  return request<{ id: string; mime: string; size: number }>(ENDPOINTS.media.root, { method: "POST", body });
};

export const attachmentKind = (file: File): AttachmentKind =>
  file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "file";

/**
 * Uploads a file picked in the composer. An image goes up as it is: the API converts it to webp
 * (so it is not end-to-end encrypted). A document or video is encrypted here with a key of its
 * own, like a voice message; the key travels inside the E2E message.
 */
export async function uploadAttachment(target: MediaTarget, file: File, thumb: string | null = null): Promise<AttachmentRef> {
  const kind = attachmentKind(file);
  const problem = checkAttachment(file);
  if (problem) throw new ApiError(400, problem);
  const name = file.name.slice(0, 255);
  if (kind === "image") {
    const { id, mime, size } = await upload(target, kind, file, name);
    return { kind, mediaId: id, mime, name, size };
  }
  const key = await generateKey();
  const { data, iv } = await encryptBytes(key, await file.arrayBuffer());
  const { id } = await upload(target, kind, new Blob([data], { type: "application/octet-stream" }), name);
  return {
    kind,
    mediaId: id,
    mime: file.type || "application/octet-stream",
    name,
    size: file.size,
    key: await exportKey(key),
    iv,
    ...(thumb && { thumb }),
  };
}

const KIND_LABEL = { image: "imagens", file: "documentos", video: "vídeos" } as const;

/** Why a picked file cannot be sent (empty, over its kind's limit), or null when it can. */
export function checkAttachment(file: File) {
  const kind = attachmentKind(file);
  const max = LIMITS.attachmentBytes[kind];
  if (file.size === 0) return "O arquivo está vazio";
  if (file.size > max) return `O arquivo passa do limite de ${max / 1024 / 1024} MB para ${KIND_LABEL[kind]}`;
  return null;
}

/**
 * Downloads (and decrypts) an attachment into an object URL.
 * The type comes from the sender, so it is narrowed: only an image or video the browser will
 * render, and everything else as opaque bytes that can only be saved, never opened as a page.
 */
export async function fetchAttachment(ref: AttachmentRef) {
  const { url } = await request<{ url: string }>(ENDPOINTS.media.detail(ref.mediaId));
  const res = await fetch(url);
  if (!res.ok) throw new Error("Arquivo indisponível");
  const bytes = await res.arrayBuffer();
  const plain = ref.key && ref.iv ? await decryptBytes(await importKey(ref.key), bytes, ref.iv) : bytes;
  if (!plain) throw new Error("Não foi possível decifrar o arquivo");
  const type =
    ref.kind === "image" ? "image/webp" : ref.kind === "video" && ref.mime.startsWith("video/") ? ref.mime : "application/octet-stream";
  return URL.createObjectURL(new Blob([plain], { type }));
}

/** Images (and a video once the user asks to play it) as an object URL. Same lifetime caveat as voice. */
export const useAttachment = (ref: AttachmentRef, enabled: boolean) =>
  useQuery({
    queryKey: messagesKeys.attachment(ref.mediaId),
    queryFn: () => fetchAttachment(ref),
    enabled,
    staleTime: Infinity,
    retry: false,
  });

/** Saves a document: fetch, decrypt, then a throwaway <a download> click. */
export async function saveAttachment(ref: AttachmentRef) {
  const url = await fetchAttachment(ref);
  const link = Object.assign(document.createElement("a"), { href: url, download: ref.name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
