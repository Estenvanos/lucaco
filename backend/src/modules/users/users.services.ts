import type { User } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { signedGetUrl } from "../../lib/storage.js";
import type { ImageFile } from "../images/images.schema.js";
import * as imagesService from "../images/images.services.js";

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
