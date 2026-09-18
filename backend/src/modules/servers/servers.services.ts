import { randomBytes } from "node:crypto";
import { DEFAULT_PERMISSIONS, PERMISSIONS, type PermissionName } from "../../lib/constants.js";
import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import { signedGetUrl } from "../../lib/storage.js";
import type { ImageFile } from "../images/images.schema.js";
import * as imagesService from "../images/images.services.js";
import type {
  CreateInviteInput,
  CreateServerInput,
  UpdateServerInput,
} from "./servers.schema.js";

export async function toPublicServer(server: {
  id: string;
  ownerId: string;
  name: string;
  iconUrl: string | null;
  visibility: "public" | "private";
  createdAt: Date;
}) {
  return {
    id: server.id,
    ownerId: server.ownerId,
    name: server.name,
    iconUrl: server.iconUrl ? await signedGetUrl(server.iconUrl) : null,
    visibility: server.visibility,
    createdAt: server.createdAt,
  };
}

/** Owner, @everyone role and the owner's membership are created together or not at all. */
export async function create(userId: string, { name, visibility }: CreateServerInput) {
  return prisma.$transaction(async (tx) => {
    const server = await tx.server.create({ data: { name, visibility, ownerId: userId } });
    await tx.role.create({
      data: {
        serverId: server.id,
        name: "@everyone",
        permissions: DEFAULT_PERMISSIONS,
        isDefault: true,
      },
    });
    await tx.serverMember.create({ data: { serverId: server.id, userId } });
    return server;
  });
}

export function listForUser(userId: string) {
  return prisma.server.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getById(serverId: string) {
  const server = await prisma.server.findUnique({ where: { id: serverId } });
  if (!server) throw new HttpError(404, "Server not found");
  return server;
}

/** Every membership check goes through here, so callers never touch server_members directly. */
export async function getMember(serverId: string, userId: string) {
  const member = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
    include: { roles: { include: { role: true } } },
  });
  if (!member) throw new HttpError(403, "Not a member of this server");
  return member;
}

export async function listMembers(serverId: string) {
  const members = await prisma.serverMember.findMany({
    where: { serverId },
    include: { user: true, roles: { select: { roleId: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    username: m.user.username,
    displayName: m.user.displayName,
    nickname: m.nickname,
    roleIds: m.roles.map((r) => r.roleId),
    joinedAt: m.joinedAt,
  }));
}

export async function join(serverId: string, userId: string) {
  const server = await getById(serverId);
  const existing = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
  });
  if (existing) return existing;
  if (server.visibility !== "public") throw new HttpError(403, "Invite required for private server");
  return prisma.serverMember.create({ data: { serverId, userId } });
}

export async function createInvite(
  serverId: string,
  userId: string,
  { maxUses, expiresAt }: CreateInviteInput,
) {
  await requirePermission(serverId, userId, "MANAGE_SERVER");
  return prisma.invite.create({
    data: {
      code: randomBytes(9).toString("base64url"),
      serverId,
      createdBy: userId,
      maxUses: maxUses ?? null,
      expiresAt: expiresAt ?? null,
    },
  });
}

export async function acceptInvite(code: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({ where: { code } });
    if (!invite) throw new HttpError(404, "Invite not found");

    const existing = await tx.serverMember.findUnique({
      where: { serverId_userId: { serverId: invite.serverId, userId } },
    });
    if (existing) return existing;

    const now = new Date();
    if (invite.expiresAt && invite.expiresAt <= now) throw new HttpError(410, "Invite expired");

    const reserved = await tx.invite.updateMany({
      where: {
        code,
        ...(invite.maxUses === null ? {} : { uses: { lt: invite.maxUses } }),
      },
      data: { uses: { increment: 1 } },
    });
    if (reserved.count === 0) throw new HttpError(410, "Invite has reached its use limit");

    return tx.serverMember.create({ data: { serverId: invite.serverId, userId } });
  });
}

export async function leave(serverId: string, userId: string) {
  const server = await getById(serverId);
  if (server.ownerId === userId) throw new HttpError(409, "The owner cannot leave the server");
  await getMember(serverId, userId);
  await prisma.serverMember.delete({ where: { serverId_userId: { serverId, userId } } });
}

/** OR of every role the member holds. The owner is implicitly an administrator. */
export async function permissionsFor(serverId: string, userId: string) {
  const server = await getById(serverId);
  if (server.ownerId === userId) return PERMISSIONS.ADMINISTRATOR;
  const member = await getMember(serverId, userId);
  const everyone = await prisma.role.findFirst({ where: { serverId, isDefault: true } });
  let permissions = everyone?.permissions ?? 0n;
  for (const { role } of member.roles) permissions |= role.permissions;
  return permissions;
}

export function has(permissions: bigint, permission: PermissionName) {
  return (
    (permissions & PERMISSIONS.ADMINISTRATOR) !== 0n ||
    (permissions & PERMISSIONS[permission]) !== 0n
  );
}

/** Throws 403 unless the user holds the permission (or ADMINISTRATOR) on that server. */
export async function requirePermission(
  serverId: string,
  userId: string,
  permission: PermissionName,
) {
  const permissions = await permissionsFor(serverId, userId);
  if (!has(permissions, permission)) throw new HttpError(403, `Missing permission: ${permission}`);
  return permissions;
}

export async function update(serverId: string, userId: string, input: UpdateServerInput) {
  await requirePermission(serverId, userId, "MANAGE_SERVER");
  return prisma.server.update({ where: { id: serverId }, data: input });
}

export async function remove(serverId: string, userId: string) {
  const server = await getById(serverId);
  if (server.ownerId !== userId) throw new HttpError(403, "Only the owner can delete the server");
  await prisma.server.delete({ where: { id: serverId } });
}

export async function updateIcon(serverId: string, userId: string, file: ImageFile) {
  await requirePermission(serverId, userId, "MANAGE_SERVER");
  const previous = await getById(serverId);
  const key = await imagesService.store(file, "servers", serverId);
  const server = await prisma.server.update({ where: { id: serverId }, data: { iconUrl: key } });
  if (previous.iconUrl) await imagesService.remove(previous.iconUrl).catch(() => {});
  return server;
}
