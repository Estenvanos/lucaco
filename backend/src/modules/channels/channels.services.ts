import type { Channel } from "../../generated/prisma/client.js";
import { ALL_PERMISSIONS, PERMISSIONS, type PermissionName } from "../../lib/constants.js";
import { HttpError } from "../../lib/http-error.js";
import { toBitfield, toNames } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import * as rolesService from "../roles/roles.services.js";
import * as serversService from "../servers/servers.services.js";
import type { CreateChannelInput, OverwriteInput, UpdateChannelInput } from "./channels.schema.js";

type Overwrite = { allow: bigint; deny: bigint };
type OverwriteRow = Overwrite & { channelId: string };
type MemberContext = {
  permissions: bigint;
  memberId: string;
  roleIds: string[];
  everyoneRoleId: string | null;
};

/**
 * Discord-style resolution (arquitetura-lucaco.md §8): server permissions, then @everyone's
 * overwrite, then every role overwrite at once (denies, then allows), then the member's own.
 * ADMINISTRATOR (and the owner, who holds it implicitly) skips every overwrite.
 */
export function resolve(
  base: bigint,
  { everyone, roles = [], member }: { everyone?: Overwrite; roles?: Overwrite[]; member?: Overwrite },
) {
  if (base & PERMISSIONS.ADMINISTRATOR) return ALL_PERMISSIONS;
  const apply = (perms: bigint, ov?: Overwrite) => (ov ? (perms & ~ov.deny) | ov.allow : perms);
  let perms = apply(base, everyone);
  perms = apply(perms, {
    allow: roles.reduce((acc, r) => acc | r.allow, 0n),
    deny: roles.reduce((acc, r) => acc | r.deny, 0n),
  });
  return apply(perms, member);
}

/** The overwrites that touch this member in the given channels, fetched in two queries. */
async function overwritesFor(channelIds: string[], ctx: MemberContext) {
  const roleIds = ctx.everyoneRoleId ? [ctx.everyoneRoleId, ...ctx.roleIds] : ctx.roleIds;
  const [roleRows, memberRows] = await Promise.all([
    prisma.channelRolePermission.findMany({ where: { channelId: { in: channelIds }, roleId: { in: roleIds } } }),
    prisma.channelMemberPermission.findMany({ where: { channelId: { in: channelIds }, memberId: ctx.memberId } }),
  ]);
  return (channelId: string) => resolveFor(ctx, channelId, roleRows, memberRows);
}

function resolveFor(
  ctx: MemberContext,
  channelId: string,
  roleRows: (OverwriteRow & { roleId: string })[],
  memberRows: (OverwriteRow & { memberId: string })[],
) {
  const inChannel = roleRows.filter((r) => r.channelId === channelId);
  return resolve(ctx.permissions, {
    everyone: inChannel.find((r) => r.roleId === ctx.everyoneRoleId),
    roles: inChannel.filter((r) => ctx.roleIds.includes(r.roleId)),
    member: memberRows.find((m) => m.channelId === channelId && m.memberId === ctx.memberId),
  });
}

const holds = (perms: bigint, name: PermissionName) => (perms & PERMISSIONS[name]) !== 0n;

export async function getById(channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel) throw new HttpError(404, "Channel not found");
  return channel;
}

/** The caller's resolved permissions in one channel. */
export async function permissionsIn(channel: Channel, userId: string) {
  const ctx = await serversService.memberPermissions(channel.serverId, userId);
  return (await overwritesFor([channel.id], ctx))(channel.id);
}

/**
 * Loads the channel and 403s unless the caller holds every permission listed, in the channel.
 * With `type`, a channel of the other kind is a 400 before any permission is read.
 */
async function requireIn(
  channelId: string,
  userId: string,
  needed: PermissionName[],
  type?: Channel["type"],
) {
  const channel = await getById(channelId);
  if (type && channel.type !== type) throw new HttpError(400, `Not a ${type} channel`);
  const permissions = await permissionsIn(channel, userId);
  const missing = needed.find((n) => !holds(permissions, n));
  if (missing) throw new HttpError(403, `Missing permission: ${missing}`);
  return { channel, permissions };
}

/** Only the channels the caller can see, each with what the caller may do in it. */
export async function list(serverId: string, userId: string) {
  const ctx = await serversService.memberPermissions(serverId, userId);
  const channels = await prisma.channel.findMany({
    where: { serverId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const permissionsOf = await overwritesFor(channels.map((c) => c.id), ctx);
  return channels.flatMap((channel) => {
    const permissions = permissionsOf(channel.id);
    return holds(permissions, "VIEW_CHANNELS") ? [{ ...channel, permissions: toNames(permissions) }] : [];
  });
}

/** Nobody can allow or deny a bit they do not hold themselves: denying is also a lever. */
function requireGrantable(mine: bigint, ...overwrites: Overwrite[]) {
  const touched = overwrites.reduce((acc, ov) => acc | ov.allow | ov.deny, 0n);
  const missing = toNames(touched & ~mine);
  if (missing.length) throw new HttpError(403, `Cannot grant: ${missing.join(", ")}`);
}

const toOverwrite = (input: OverwriteInput): Overwrite => ({
  allow: toBitfield(input.allow),
  deny: toBitfield(input.deny),
});

export async function create(serverId: string, userId: string, input: CreateChannelInput) {
  const mine = await serversService.requirePermission(serverId, userId, "MANAGE_CHANNELS");
  const { roles, members } = input.permissions;
  if (roles.length || members.length) {
    await serversService.requirePermission(serverId, userId, "MANAGE_ROLES");
    const grantable = serversService.has(mine, "ADMINISTRATOR") ? ALL_PERMISSIONS : mine;
    requireGrantable(grantable, ...[...roles, ...members].map(toOverwrite));
    await rolesService.requireRoles(serverId, roles.map((r) => r.roleId));
    await serversService.requireMembers(serverId, members.map((m) => m.memberId));
  }
  // ponytail: a non-admin who hides the channel from @everyone can hide it from themselves too —
  // the UI adds the creator's member overwrite; auto-adding it here if that bites.
  return prisma.$transaction(async (tx) => {
    const channel = await tx.channel.create({
      data: {
        serverId,
        name: input.name,
        type: input.type,
        topic: input.topic ?? null,
        position: input.position ?? 0,
        ...(input.userLimit !== undefined && { userLimit: input.userLimit }),
      },
    });
    if (roles.length) {
      await tx.channelRolePermission.createMany({
        data: roles.map((r) => ({ channelId: channel.id, roleId: r.roleId, ...toOverwrite(r) })),
      });
    }
    if (members.length) {
      await tx.channelMemberPermission.createMany({
        data: members.map((m) => ({ channelId: channel.id, memberId: m.memberId, ...toOverwrite(m) })),
      });
    }
    return channel;
  });
}

export async function update(channelId: string, userId: string, input: UpdateChannelInput) {
  await requireIn(channelId, userId, ["MANAGE_CHANNELS"]);
  return prisma.channel.update({
    where: { id: channelId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.topic !== undefined && { topic: input.topic ?? null }),
      ...(input.position !== undefined && { position: input.position }),
      ...(input.userLimit !== undefined && { userLimit: input.userLimit }),
    },
  });
}

export async function remove(channelId: string, userId: string) {
  await requireIn(channelId, userId, ["MANAGE_CHANNELS"]);
  await prisma.channel.delete({ where: { id: channelId } });
  // ponytail: the channel's messages stay in Mongo. A jobs-module cleanup deletes them;
  // until then they are unreadable anyway (no member holds the channel key).
}

/** The channel's overwrites, for the permissions screen. MANAGE_ROLES in the channel. */
export async function getPermissions(channelId: string, userId: string) {
  await requireIn(channelId, userId, ["MANAGE_ROLES"]);
  const [roles, members] = await Promise.all([
    prisma.channelRolePermission.findMany({ where: { channelId } }),
    prisma.channelMemberPermission.findMany({ where: { channelId } }),
  ]);
  const names = (ov: Overwrite) => ({ allow: toNames(ov.allow), deny: toNames(ov.deny) });
  return {
    roles: roles.map((r) => ({ roleId: r.roleId, ...names(r) })),
    members: members.map((m) => ({ memberId: m.memberId, ...names(m) })),
  };
}

/**
 * Sets (or with both lists empty, clears) one overwrite. The caller needs MANAGE_ROLES in the
 * channel and must hold every bit in both the old and the new overwrite: removing a deny grants.
 */
export async function setRolePermission(channelId: string, roleId: string, userId: string, input: OverwriteInput) {
  const { channel, permissions } = await requireIn(channelId, userId, ["MANAGE_ROLES"]);
  await rolesService.requireRoles(channel.serverId, [roleId]);
  const where = { channelId_roleId: { channelId, roleId } };
  const current = await prisma.channelRolePermission.findUnique({ where });
  const next = toOverwrite(input);
  requireGrantable(permissions, next, current ?? { allow: 0n, deny: 0n });
  if (!next.allow && !next.deny) {
    await prisma.channelRolePermission.deleteMany({ where: { channelId, roleId } });
    return;
  }
  await prisma.channelRolePermission.upsert({ where, create: { channelId, roleId, ...next }, update: next });
}

export async function setMemberPermission(channelId: string, memberId: string, userId: string, input: OverwriteInput) {
  const { channel, permissions } = await requireIn(channelId, userId, ["MANAGE_ROLES"]);
  await serversService.requireMembers(channel.serverId, [memberId]);
  const where = { channelId_memberId: { channelId, memberId } };
  const current = await prisma.channelMemberPermission.findUnique({ where });
  const next = toOverwrite(input);
  requireGrantable(permissions, next, current ?? { allow: 0n, deny: 0n });
  if (!next.allow && !next.deny) {
    await prisma.channelMemberPermission.deleteMany({ where: { channelId, memberId } });
    return;
  }
  await prisma.channelMemberPermission.upsert({ where, create: { channelId, memberId, ...next }, update: next });
}

/** How other modules (messages, voice, media) ask whether a user may read a channel. */
export async function canView(channelId: string, userId: string) {
  return (await requireIn(channelId, userId, ["VIEW_CHANNELS"])).channel;
}

const requireText = async (channelId: string, userId: string, ...needed: PermissionName[]) =>
  (await requireIn(channelId, userId, ["VIEW_CHANNELS", ...needed], "text")).channel;

/** Sending needs VIEW_CHANNELS too: a member who cannot read the channel cannot write to it. */
export const canSend = (channelId: string, userId: string) => requireText(channelId, userId, "SEND_MESSAGES");

export const canSendVoice = (channelId: string, userId: string) =>
  requireText(channelId, userId, "SEND_MESSAGES", "SEND_VOICE_MESSAGES");

/** Images, documents and videos need ATTACH_FILES on top of writing in the channel. */
export const canAttach = (channelId: string, userId: string) =>
  requireText(channelId, userId, "SEND_MESSAGES", "ATTACH_FILES");

/** Deleting somebody else's message. */
export const canManageMessages = (channelId: string, userId: string) =>
  requireText(channelId, userId, "MANAGE_MESSAGES");

const requireVoice = (channelId: string, userId: string, ...needed: PermissionName[]) =>
  requireIn(channelId, userId, needed, "voice");

/** Voice rooms are always backed by the server's persisted voice channel. */
export async function canConnect(channelId: string, userId: string) {
  const { channel, permissions } = await requireVoice(channelId, userId, "VIEW_CHANNELS", "CONNECT");
  return { ...channel, canSpeak: holds(permissions, "SPEAK"), canStream: holds(permissions, "STREAM") };
}

/** Members may see who is in voice without joining the call themselves. */
export async function canViewVoice(channelId: string, userId: string) {
  return (await requireVoice(channelId, userId, "VIEW_CHANNELS")).channel;
}

export async function canStream(channelId: string, userId: string) {
  return (await requireVoice(channelId, userId, "VIEW_CHANNELS", "CONNECT", "STREAM")).channel;
}

/** Users who can currently read the channel: who a new message is pushed to, who gets a key. */
export async function viewerIds(channelId: string) {
  const channel = await getById(channelId);
  const members = await serversService.allMemberPermissions(channel.serverId);
  const [roleRows, memberRows] = await Promise.all([
    prisma.channelRolePermission.findMany({ where: { channelId } }),
    prisma.channelMemberPermission.findMany({ where: { channelId } }),
  ]);
  return members
    .filter((ctx) => holds(resolveFor(ctx, channelId, roleRows, memberRows), "VIEW_CHANNELS"))
    .map((ctx) => ctx.userId);
}
