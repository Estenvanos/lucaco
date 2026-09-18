import type { User } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { signedGetUrl } from "../../lib/storage.js";
import type { ImageFile } from "../images/images.schema.js";
import * as imagesService from "../images/images.services.js";
import type { PublishKeyInput } from "./users.schema.js";

export async function toPublicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ? await signedGetUrl(user.avatarUrl) : null,
    createdAt: user.createdAt,
  };
}

export async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function updateAvatar(userId: string, file: ImageFile) {
  const previous = await getById(userId);
  const key = await imagesService.store(file, "avatars", userId);
  const user = await prisma.user.update({ where: { id: userId }, data: { avatarUrl: key } });
  if (previous.avatarUrl) await imagesService.remove(previous.avatarUrl).catch(() => {});
  return user;
}

/**
 * Publishing a key deactivates the previous one in the same transaction: the partial unique
 * index (one_active_key_per_user) rejects two active rows, and old rows stay so messages
 * encrypted for them keep their reference.
 */
export async function publishKey(userId: string, { publicKey, algorithm }: PublishKeyInput) {
  return prisma.$transaction(async (tx) => {
    await tx.userKey.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
    return tx.userKey.create({ data: { userId, publicKey, algorithm } });
  });
}

/** Other modules and peers read the active public key through here. 404 until the user publishes one. */
export async function getActiveKey(userId: string) {
  const key = await prisma.userKey.findFirst({ where: { userId, isActive: true } });
  if (!key) throw new HttpError(404, "User has no published key");
  return { userId, publicKey: key.publicKey, algorithm: key.algorithm, createdAt: key.createdAt };
}
