import { randomUUID } from "node:crypto";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { putObject, signedGetUrl } from "../../lib/storage.js";
import * as imagesService from "../images/images.services.js";
import * as channelsService from "../channels/channels.services.js";
import * as friendsService from "../friends/friends.services.js";
import * as messagesService from "../messages/messages.services.js";
import type { MediaFileInput, MediaKind, UploadTarget } from "./media.schema.js";

/** Short: the link only has to live until the browser downloads the file. */
const URL_TTL_SECONDS = 300;

/**
 * Stores an attachment for a conversation, under the same rules as sending the message itself.
 * voice/file/video are ciphertext the browser already encrypted and are kept as they are. An
 * image arrives in the clear and is converted to webp here with the `images` module's sharp.
 * ponytail: a file whose message never gets sent stays orphaned — the jobs module sweeps it.
 */
export async function upload(userId: string, target: UploadTarget, kind: MediaKind, file: MediaFileInput) {
  let scope: "dm" | "channel";
  let conversationId: string;
  if ("channelId" in target) {
    await (kind === "voice" ? channelsService.canSendVoice : channelsService.canAttach)(target.channelId, userId);
    scope = "channel";
    conversationId = target.channelId;
  } else {
    if (!(await friendsService.areFriends(userId, target.peerId))) {
      throw new HttpError(403, "You can only message friends");
    }
    scope = "dm";
    conversationId = messagesService.dmId(userId, target.peerId);
  }
  const id = randomUUID();
  const storageKey = `media/${conversationId}/${id}`;
  const image = kind === "image";
  const body = image ? await imagesService.toWebp({ buffer: file.buffer }, "attachments") : file.buffer;
  const mime = image ? "image/webp" : "application/octet-stream";
  await putObject(storageKey, body, mime);
  await prisma.mediaFile.create({
    data: { id, uploaderId: userId, scope, conversationId, storageKey, kind, sizeBytes: body.length },
  });
  return { id, mime, size: body.length };
}

/** A short-lived download link, for whoever can read the conversation the file was sent to. */
export async function getUrl(mediaId: string, userId: string) {
  const media = await prisma.mediaFile.findUnique({ where: { id: mediaId } });
  if (!media) throw new HttpError(404, "Media not found");
  if (media.scope === "channel") {
    await channelsService.canView(media.conversationId, userId);
  } else if (
    media.uploaderId !== userId &&
    messagesService.dmId(userId, media.uploaderId) !== media.conversationId
  ) {
    throw new HttpError(403, "Not part of this conversation");
  }
  return { url: await signedGetUrl(media.storageKey, URL_TTL_SECONDS) };
}
