import { randomBytes } from "node:crypto";
import {
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  NOTIFICATION_TAGS,
  PERMISSIONS,
  SOCKET_EVENTS,
  type PermissionName,
} from "../../lib/constants.js";
import { HttpError } from "../../lib/http-error.js";
import { logger } from "../../lib/logger.js";
import { toNames } from "../../lib/permissions.js";
import { prisma, withUser } from "../../lib/prisma.js";
import { emitToUser } from "../../lib/socket.js";
import { signedGetUrl } from "../../lib/storage.js";
import * as auditService from "../audit/audit.services.js";
import type { ImageFile } from "../images/images.schema.js";
import * as imagesService from "../images/images.services.js";
import * as notificationsService from "../notifications/notifications.services.js";
import * as usersService from "../users/users.services.js";
import type {
  CreateInviteInput,
  CreateServerInput,
  DiscoverServersInput,
  UpdateServerInput,
} from "./servers.schema.js";

export async function toPublicServer(server: {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  tag: string | null;
  visibility: "public" | "private";
  createdAt: Date;
}) {
  return {
    id: server.id,
    ownerId: server.ownerId,
    name: server.name,
    description: server.description,
    category: server.category,
    iconUrl: server.iconUrl ? await signedGetUrl(server.iconUrl) : null,
    bannerUrl: server.bannerUrl ? await signedGetUrl(server.bannerUrl) : null,
    tag: server.tag,
    visibility: server.visibility,
    createdAt: server.createdAt,
  };
}

/**
 * Owner, @everyone role, the owner's membership and the default channels ("geral" text, the
 * single "voz" voice) are created together or not at all.
 */
export async function create(userId: string, input: CreateServerInput) {
  return prisma.$transaction(async (tx) => {
    const server = await tx.server.create({ data: { ...input, ownerId: userId } });
    await tx.role.create({
      data: {
        serverId: server.id,
        name: "@everyone",
        permissions: DEFAULT_PERMISSIONS,
        isDefault: true,
      },
    });
    await tx.serverMember.create({ data: { serverId: server.id, userId } });
    await tx.channel.createMany({
      data: [
        { serverId: server.id, type: "text", name: "geral" },
        { serverId: server.id, type: "voice", name: "voz" },
      ],
    });
    return server;
  });
}

export function listForUser(userId: string) {
  return prisma.server.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Lowercase, accents stripped, spaces collapsed: "  São  Paulo" and "sao paulo" compare equal. */
const normalize = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** pg_trgm-style trigrams: each word padded with two spaces in front and one behind. */
const trigrams = (word: string) => {
  const padded = `  ${word} `;
  return new Set(Array.from({ length: padded.length - 2 }, (_, i) => padded.slice(i, i + 3)));
};

const similarity = (a: string, b: string) => {
  const ta = trigrams(a);
  const tb = trigrams(b);
  const shared = [...ta].filter((t) => tb.has(t)).length;
  return shared / (ta.size + tb.size - shared);
};

const FUZZY_THRESHOLD = 0.3;

/**
 * How well `name` answers `query`, 0 = not at all. Literal hits (prefix, word prefix, substring)
 * always rank above fuzzy ones; typos ("pixl", "clbu") still land through trigram similarity
 * against the whole name or its closest word.
 */
function matchScore(name: string, query: string) {
  if (name === query) return 1;
  if (name.startsWith(query)) return 0.9;
  if (name.split(" ").some((word) => word.startsWith(query))) return 0.8;
  if (name.includes(query)) return 0.7;
  const best = Math.max(similarity(name, query), ...name.split(" ").map((w) => similarity(w, query)));
  return best >= FUZZY_THRESHOLD ? best * 0.6 : 0;
}

/**
 * The user's own servers ranked by similarity to `query`; an empty query lists them all.
 * ponytail: scores in memory over the user's memberships only — move to pg_trgm (GIN index on
 * lower(name)) when search has to cover every public server.
 */
export async function search(userId: string, query: string) {
  const servers = await listForUser(userId);
  const term = normalize(query);
  if (!term) return servers;
  return servers
    .map((server) => ({ server, score: matchScore(normalize(server.name), term) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.server.name.localeCompare(b.server.name))
    .map(({ server }) => server);
}

const DISCOVER_LIMIT = 60;

/**
 * Public servers for the discovery page, biggest first, filtered by category and name.
 * ponytail: plain ILIKE, no ranking or typo tolerance and no paging past DISCOVER_LIMIT — move to
 * pg_trgm + cursor paging when the public catalogue grows.
 */
export async function discover({ q, category }: DiscoverServersInput) {
  const servers = await prisma.server.findMany({
    where: {
      visibility: "public",
      ...(category && { category }),
      ...(q && { name: { contains: q, mode: "insensitive" as const } }),
    },
    include: { _count: { select: { members: true } } },
    orderBy: [{ members: { _count: "desc" } }, { createdAt: "asc" }],
    take: DISCOVER_LIMIT,
  });
  return servers.map(({ _count, ...server }) => ({ ...server, memberCount: _count.members }));
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

/** 404 unless memberId is a membership of this server. */
export async function getMemberById(serverId: string, memberId: string) {
  const member = await prisma.serverMember.findUnique({ where: { id: memberId } });
  if (!member || member.serverId !== serverId) throw new HttpError(404, "Member not found");
  return member;
}

// ponytail: the whole member list in one response, searched on the client — page it and search
// server-side when servers reach a few thousand members.
export async function listMembers(serverId: string) {
  const server = await getById(serverId);
  const members = await prisma.serverMember.findMany({
    where: { serverId },
    include: { user: true, roles: { include: { role: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return Promise.all(
    members.map(async (m) => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl ? await signedGetUrl(m.user.avatarUrl) : null,
      status: m.user.status,
      nickname: m.nickname,
      roleIds: m.roles.map((r) => r.roleId),
      isAdmin:
        m.userId === server.ownerId ||
        m.roles.some(({ role }) => (role.permissions & PERMISSIONS.ADMINISTRATOR) !== 0n),
      joinedAt: m.joinedAt,
    })),
  );
}

const ACTIVITY_TEXT = {
  join: (actor: string) => `${actor} entrou no server`,
  leave: (actor: string) => `${actor} saiu do server`,
  kick: (actor: string, target: string) => `${actor} expulsou ${target}`,
  ban: (actor: string, target: string) => `${actor} baniu ${target}`,
};

/**
 * Tells every moderator (KICK_MEMBERS or BAN_MEMBERS; administrators and the owner hold both)
 * what happened, except whoever took part.
 * Best effort: a failed notice is logged and never undoes the action.
 */
async function notifyAdmins(
  serverId: string,
  event: keyof typeof ACTIVITY_TEXT,
  actorId: string,
  targetId?: string,
) {
  try {
    const [server, members, profiles] = await Promise.all([
      getById(serverId),
      allMemberPermissions(serverId),
      usersService.getProfiles(targetId ? [actorId, targetId] : [actorId]),
    ]);
    const name = (id: string) => {
      const profile = profiles.get(id);
      return profile ? (profile.displayName ?? profile.username) : "Alguém";
    };
    const title = ACTIVITY_TEXT[event](name(actorId), targetId ? name(targetId) : "").slice(0, 120);
    const admins = members.filter(
      (m) =>
        (has(m.permissions, "KICK_MEMBERS") || has(m.permissions, "BAN_MEMBERS")) &&
        m.userId !== actorId &&
        m.userId !== targetId,
    );
    await Promise.all(
      admins.map((admin) =>
        notificationsService.notify({
          tag: NOTIFICATION_TAGS.serverActivity,
          title,
          subtitle: server.name.slice(0, 120),
          ownerId: actorId,
          receiverId: admin.userId,
          serverId,
        }),
      ),
    );
  } catch (err) {
    logger.error("server activity notice failed", err);
  }
}

export async function join(serverId: string, userId: string) {
  const server = await getById(serverId);
  const existing = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId } },
  });
  if (existing) return existing;
  await requireNotBanned(serverId, userId);
  if (server.visibility !== "public") throw new HttpError(403, "Invite required for private server");
  const member = await prisma.serverMember.create({ data: { serverId, userId } });
  await notifyAdmins(serverId, "join", userId);
  return member;
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
  let joined = false;
  const member = await prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({ where: { code } });
    if (!invite) throw new HttpError(404, "Invite not found");

    const existing = await tx.serverMember.findUnique({
      where: { serverId_userId: { serverId: invite.serverId, userId } },
    });
    if (existing) return existing;

    const banned = await tx.serverBan.findUnique({
      where: { serverId_userId: { serverId: invite.serverId, userId } },
    });
    if (banned) throw new HttpError(403, "You are banned from this server");

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

    joined = true;
    return tx.serverMember.create({ data: { serverId: invite.serverId, userId } });
  });
  if (joined) await notifyAdmins(member.serverId, "join", userId);
  return member;
}

export async function leave(serverId: string, userId: string) {
  const server = await getById(serverId);
  if (server.ownerId === userId) throw new HttpError(409, "The owner cannot leave the server");
  await getMember(serverId, userId);
  await prisma.serverMember.delete({ where: { serverId_userId: { serverId, userId } } });
  await notifyAdmins(serverId, "leave", userId);
}

async function requireNotBanned(serverId: string, userId: string) {
  const banned = await prisma.serverBan.findUnique({ where: { serverId_userId: { serverId, userId } } });
  if (banned) throw new HttpError(403, "You are banned from this server");
}

/**
 * Kick and ban share the rules: nobody removes themselves (that is leave) or the owner, and only
 * the owner removes an administrator. Returns the target's membership.
 */
async function requireCanRemove(
  serverId: string,
  actorId: string,
  targetId: string,
  permission: "KICK_MEMBERS" | "BAN_MEMBERS",
) {
  if (actorId === targetId) throw new HttpError(409, "You cannot remove yourself");
  const server = await getById(serverId);
  await requirePermission(serverId, actorId, permission);
  if (server.ownerId === targetId) throw new HttpError(403, "The owner cannot be removed");
  const target = await prisma.serverMember.findUnique({
    where: { serverId_userId: { serverId, userId: targetId } },
    include: { roles: { include: { role: true } } },
  });
  if (!target) throw new HttpError(404, "Member not found");
  const targetIsAdmin = target.roles.some(({ role }) => has(role.permissions, "ADMINISTRATOR"));
  if (targetIsAdmin && server.ownerId !== actorId) {
    throw new HttpError(403, "Only the owner can remove an administrator");
  }
  return target;
}

// ponytail: a removed user in the voice call stays connected until they leave (rejoining fails,
// since voice checks membership) — drop their peer from the voice service if that matters.
/** Removes the member; they can join again. */
export async function kick(serverId: string, targetId: string, actorId: string) {
  const target = await requireCanRemove(serverId, actorId, targetId, "KICK_MEMBERS");
  await prisma.$transaction(async (tx) => {
    await tx.serverMember.delete({ where: { id: target.id } });
    await auditService.record(tx, { serverId, actorId, action: "member_kick", targetUserId: targetId });
  });
  emitToUser(targetId, SOCKET_EVENTS.serverRemoved, { serverId });
  await notifyAdmins(serverId, "kick", actorId, targetId);
}

/** Removes the member and keeps them from joining again. */
export async function ban(serverId: string, targetId: string, actorId: string) {
  const target = await requireCanRemove(serverId, actorId, targetId, "BAN_MEMBERS");
  await prisma.$transaction(async (tx) => {
    await tx.serverMember.delete({ where: { id: target.id } });
    await tx.serverBan.upsert({
      where: { serverId_userId: { serverId, userId: targetId } },
      create: { serverId, userId: targetId, bannedBy: actorId },
      update: {},
    });
    await auditService.record(tx, { serverId, actorId, action: "member_ban", targetUserId: targetId });
  });
  emitToUser(targetId, SOCKET_EVENTS.serverRemoved, { serverId });
  await notifyAdmins(serverId, "ban", actorId, targetId);
}

/** Banned users with who banned them, newest first. Needs BAN_MEMBERS (and RLS checks it too). */
export async function listBans(serverId: string, userId: string) {
  await requirePermission(serverId, userId, "BAN_MEMBERS");
  const bans = await withUser(userId, (tx) =>
    tx.serverBan.findMany({ where: { serverId }, orderBy: { createdAt: "desc" } }),
  );
  const profiles = await usersService.getProfiles([...new Set(bans.flatMap((b) => [b.userId, b.bannedBy]))]);
  return bans.map((ban) => ({
    user: profiles.get(ban.userId) ?? null,
    bannedBy: profiles.get(ban.bannedBy) ?? null,
    createdAt: ban.createdAt,
  }));
}

/** Lifts a ban; the user can join again. */
export async function unban(serverId: string, targetId: string, actorId: string) {
  await requirePermission(serverId, actorId, "BAN_MEMBERS");
  await withUser(actorId, async (tx) => {
    const { count } = await tx.serverBan.deleteMany({ where: { serverId, userId: targetId } });
    if (count === 0) throw new HttpError(404, "Ban not found");
    await auditService.record(tx, { serverId, actorId, action: "member_unban", targetUserId: targetId });
  });
}

/**
 * The member's server-wide permissions (OR of every role, @everyone included) plus what channel
 * overwrites need to be applied on top: the member id, their role ids and @everyone's id.
 * The owner is implicitly an administrator.
 */
export async function memberPermissions(serverId: string, userId: string) {
  const server = await getById(serverId);
  const member = await getMember(serverId, userId);
  const everyone = await prisma.role.findFirst({ where: { serverId, isDefault: true } });
  let permissions = everyone?.permissions ?? 0n;
  for (const { role } of member.roles) permissions |= role.permissions;
  if (server.ownerId === userId) permissions |= PERMISSIONS.ADMINISTRATOR;
  return {
    permissions,
    memberId: member.id,
    roleIds: member.roles.map((r) => r.roleId),
    everyoneRoleId: everyone?.id ?? null,
  };
}

/** memberPermissions for every member at once (who can see a channel, who gets a message). */
export async function allMemberPermissions(serverId: string) {
  const server = await getById(serverId);
  const [members, everyone] = await Promise.all([
    prisma.serverMember.findMany({ where: { serverId }, include: { roles: { include: { role: true } } } }),
    prisma.role.findFirst({ where: { serverId, isDefault: true } }),
  ]);
  return members.map((member) => {
    let permissions = everyone?.permissions ?? 0n;
    for (const { role } of member.roles) permissions |= role.permissions;
    if (server.ownerId === member.userId) permissions |= PERMISSIONS.ADMINISTRATOR;
    return {
      userId: member.userId,
      permissions,
      memberId: member.id,
      roleIds: member.roles.map((r) => r.roleId),
      everyoneRoleId: everyone?.id ?? null,
    };
  });
}

/** 404 unless every id is a member of this server. */
export async function requireMembers(serverId: string, memberIds: string[]) {
  if (!memberIds.length) return;
  const found = await prisma.serverMember.count({ where: { serverId, id: { in: memberIds } } });
  if (found !== new Set(memberIds).size) throw new HttpError(404, "Member not found");
}

/** OR of every role the member holds. The owner is implicitly an administrator. */
export async function permissionsFor(serverId: string, userId: string) {
  return (await memberPermissions(serverId, userId)).permissions;
}

/** GET /servers/:id/permissions: what the caller holds server-wide (ADMINISTRATOR expanded). */
export async function myPermissions(serverId: string, userId: string) {
  const permissions = await permissionsFor(serverId, userId);
  return toNames(has(permissions, "ADMINISTRATOR") ? ALL_PERMISSIONS : permissions);
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
  return prisma.$transaction(async (tx) => {
    const server = await tx.server.update({ where: { id: serverId }, data: input });
    await auditService.record(tx, {
      serverId,
      actorId: userId,
      action: "server_update",
      details: { fields: Object.keys(input).filter((k) => input[k as keyof UpdateServerInput] !== undefined) },
    });
    return server;
  });
}

export async function remove(serverId: string, userId: string) {
  const server = await getById(serverId);
  if (server.ownerId !== userId) throw new HttpError(403, "Only the owner can delete the server");
  await prisma.server.delete({ where: { id: serverId } });
}

/** Stores the new image, points the column at it, then drops the old file (best effort). */
async function replaceImage(
  serverId: string,
  userId: string,
  file: ImageFile,
  column: "iconUrl" | "bannerUrl",
  folder: "servers" | "banners",
) {
  await requirePermission(serverId, userId, "MANAGE_SERVER");
  const previous = await getById(serverId);
  const key = await imagesService.store(file, folder, serverId);
  const server = await prisma.$transaction(async (tx) => {
    const updated = await tx.server.update({ where: { id: serverId }, data: { [column]: key } });
    await auditService.record(tx, { serverId, actorId: userId, action: "server_update", details: { fields: [column] } });
    return updated;
  });
  const old = previous[column];
  if (old) await imagesService.remove(old).catch(() => {});
  return server;
}

export const updateIcon = (serverId: string, userId: string, file: ImageFile) =>
  replaceImage(serverId, userId, file, "iconUrl", "servers");

export const updateBanner = (serverId: string, userId: string, file: ImageFile) =>
  replaceImage(serverId, userId, file, "bannerUrl", "banners");
