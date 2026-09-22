import type { User } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { signedGetUrl } from "../../lib/storage.js";
import type { ImageFile } from "../images/images.schema.js";
import * as imagesService from "../images/images.services.js";
import type {
  PublishKeyInput,
  UpdateProfileInput,
  UpdateSettingsInput,
  UpdateStatusInput,
} from "./users.schema.js";

export async function toPublicUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ? await signedGetUrl(user.avatarUrl) : null,
    status: user.status,
    createdAt: user.createdAt,
    settings: {
      theme: user.theme,
      notificationsMuted: user.notificationsMuted,
      hiddenNotificationTags: user.hiddenNotificationTags,
      audioInputId: user.audioInputId,
      audioOutputId: user.audioOutputId,
      mutedUserIds: user.mutedUserIds,
    },
  };
}

export async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

export async function getByUsername(username: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new HttpError(404, "User not found");
  return user;
}

/** What other users may see about someone: no email. Unknown ids are left out of the map. */
export async function getProfiles(ids: string[]) {
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const profiles = await Promise.all(
    users.map(async (user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ? await signedGetUrl(user.avatarUrl) : null,
      createdAt: user.createdAt,
    })),
  );
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

export function updateStatus(userId: string, { status }: UpdateStatusInput) {
  return prisma.user.update({ where: { id: userId }, data: { status } });
}

/** The unique index still guards the race; this check only gives the taken case a clear message. */
export async function updateProfile(userId: string, input: UpdateProfileInput) {
  if (input.username) {
    const owner = await prisma.user.findUnique({ where: { username: input.username } });
    if (owner && owner.id !== userId) throw new HttpError(409, "Username already taken");
  }
  return prisma.user.update({ where: { id: userId }, data: input });
}

export function updateSettings(userId: string, input: UpdateSettingsInput) {
  return prisma.user.update({ where: { id: userId }, data: input });
}

/** Right-click > Silenciar: notifications from that user stop being stored for this one. */
export async function mute(userId: string, targetId: string) {
  if (userId === targetId) throw new HttpError(409, "You cannot mute yourself");
  const user = await getById(userId);
  await getById(targetId);
  if (user.mutedUserIds.includes(targetId)) return user;
  return prisma.user.update({ where: { id: userId }, data: { mutedUserIds: { push: targetId } } });
}

export async function unmute(userId: string, targetId: string) {
  const user = await getById(userId);
  return prisma.user.update({
    where: { id: userId },
    data: { mutedUserIds: user.mutedUserIds.filter((id) => id !== targetId) },
  });
}

export async function isMuted(userId: string, targetId: string) {
  const muted = await prisma.user.count({ where: { id: userId, mutedUserIds: { has: targetId } } });
  return muted > 0;
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
 * encrypted for them keep their reference. Republishing the active key only attaches the backup:
 * rotating would cut peers off a key that did not change.
 */
export async function publishKey(userId: string, { publicKey, algorithm, backup }: PublishKeyInput) {
  const backupData = backup && {
    encryptedPrivateKey: backup.encryptedPrivateKey,
    backupSalt: backup.salt,
    backupIv: backup.iv,
  };
  return prisma.$transaction(async (tx) => {
    const active = await tx.userKey.findFirst({ where: { userId, isActive: true } });
    if (active?.publicKey === publicKey) {
      return backupData ? tx.userKey.update({ where: { id: active.id }, data: backupData }) : active;
    }
    await tx.userKey.updateMany({ where: { userId, isActive: true }, data: { isActive: false } });
    return tx.userKey.create({ data: { userId, publicKey, algorithm, ...backupData } });
  });
}

/** The owner's active key with its encrypted backup (null if none). Never served to peers. */
export async function getKeyBackup(userId: string) {
  const key = await prisma.userKey.findFirst({ where: { userId, isActive: true } });
  if (!key) throw new HttpError(404, "User has no published key");
  const { encryptedPrivateKey, backupSalt, backupIv } = key;
  return {
    publicKey: key.publicKey,
    algorithm: key.algorithm,
    backup:
      encryptedPrivateKey && backupSalt && backupIv
        ? { encryptedPrivateKey, salt: backupSalt, iv: backupIv }
        : null,
  };
}

/** Other modules and peers read the active public key through here. 404 until the user publishes one. */
export async function getActiveKey(userId: string) {
  const key = await prisma.userKey.findFirst({ where: { userId, isActive: true } });
  if (!key) throw new HttpError(404, "User has no published key");
  return { userId, publicKey: key.publicKey, algorithm: key.algorithm, createdAt: key.createdAt };
}

/** Active public keys of several users at once; users with no published key are left out. */
export async function getActiveKeys(userIds: string[]) {
  if (!userIds.length) return [];
  const keys = await prisma.userKey.findMany({ where: { userId: { in: userIds }, isActive: true } });
  return keys.map((k) => ({ userId: k.userId, publicKey: k.publicKey }));
}
