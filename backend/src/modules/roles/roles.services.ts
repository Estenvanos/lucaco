import type { Role } from "../../generated/prisma/client.js";
import { PERMISSIONS, type PermissionName } from "../../lib/constants.js";
import { HttpError } from "../../lib/http-error.js";
import { toBitfield, toNames } from "../../lib/permissions.js";
import { prisma } from "../../lib/prisma.js";
import * as auditService from "../audit/audit.services.js";
import * as serversService from "../servers/servers.services.js";
import type { CreateRoleInput, UpdateRoleInput } from "./roles.schema.js";

export const toPublicRole = (role: Role) => ({
  id: role.id,
  serverId: role.serverId,
  name: role.name,
  color: role.color,
  position: role.position,
  isDefault: role.isDefault,
  permissions: toNames(role.permissions),
  createdAt: role.createdAt,
});

export async function list(serverId: string, userId: string) {
  await serversService.getMember(serverId, userId);
  const roles = await prisma.role.findMany({
    where: { serverId },
    orderBy: [{ position: "desc" }, { createdAt: "asc" }],
  });
  return roles.map(toPublicRole);
}

async function getRole(serverId: string, roleId: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.serverId !== serverId) throw new HttpError(404, "Role not found");
  return role;
}

/** 404 unless every id is a role of this server. */
export async function requireRoles(serverId: string, roleIds: string[]) {
  if (!roleIds.length) return;
  const found = await prisma.role.count({ where: { serverId, id: { in: roleIds } } });
  if (found !== new Set(roleIds).size) throw new HttpError(404, "Role not found");
}

/** Nobody can grant a permission they do not hold themselves, which blocks self-escalation. */
async function requireGrantable(serverId: string, userId: string, names: PermissionName[]) {
  const mine = await serversService.requirePermission(serverId, userId, "MANAGE_ROLES");
  const missing = names.filter((n) => !serversService.has(mine, n));
  if (missing.length) throw new HttpError(403, `Cannot grant: ${missing.join(", ")}`);
}

export async function create(serverId: string, userId: string, input: CreateRoleInput) {
  await requireGrantable(serverId, userId, input.permissions);
  const role = await prisma.role.create({
    data: {
      serverId,
      name: input.name,
      color: input.color ?? null,
      position: input.position ?? 0,
      permissions: toBitfield(input.permissions),
    },
  });
  return toPublicRole(role);
}

export async function update(
  serverId: string,
  roleId: string,
  userId: string,
  input: UpdateRoleInput,
) {
  await requireGrantable(serverId, userId, input.permissions ?? []);
  const current = await getRole(serverId, roleId);
  if (current.isDefault && input.name && input.name !== current.name) {
    throw new HttpError(409, "The @everyone role cannot be renamed");
  }
  const role = await prisma.role.update({
    where: { id: roleId },
    data: {
      name: input.name,
      color: input.color,
      position: input.position,
      permissions: input.permissions ? toBitfield(input.permissions) : undefined,
    },
  });
  return toPublicRole(role);
}

export async function remove(serverId: string, roleId: string, userId: string) {
  await serversService.requirePermission(serverId, userId, "MANAGE_ROLES");
  const role = await getRole(serverId, roleId);
  if (role.isDefault) throw new HttpError(409, "The @everyone role cannot be deleted");
  await prisma.role.delete({ where: { id: roleId } });
}

export async function assign(serverId: string, roleId: string, memberId: string, userId: string) {
  const role = await getRole(serverId, roleId);
  await requireGrantable(serverId, userId, toNames(role.permissions));
  if (role.isDefault) throw new HttpError(409, "@everyone applies to every member already");
  const member = await serversService.getMemberById(serverId, memberId);
  await prisma.$transaction(async (tx) => {
    await tx.memberRole.upsert({
      where: { memberId_roleId: { memberId, roleId } },
      create: { memberId, roleId },
      update: {},
    });
    await auditService.record(tx, {
      serverId,
      actorId: userId,
      action: "role_add",
      targetUserId: member.userId,
      details: { roleId, roleName: role.name },
    });
  });
}

const ADMIN_ROLE_NAME = "Admin";

/**
 * Right-click > Tornar admin: an owner-only shortcut. Granting uses a role named "Admin" holding
 * ADMINISTRATOR, created on first use; revoking drops every ADMINISTRATOR role the member has.
 */
export async function setAdmin(serverId: string, memberId: string, userId: string, admin: boolean) {
  const server = await serversService.getById(serverId);
  if (server.ownerId !== userId) throw new HttpError(403, "Only the owner can manage administrators");
  const member = await serversService.getMemberById(serverId, memberId);
  if (member.userId === server.ownerId) throw new HttpError(409, "The owner is always an administrator");

  const roles = await prisma.role.findMany({ where: { serverId } });
  const adminRoles = roles.filter((r) => serversService.has(r.permissions, "ADMINISTRATOR"));
  const audit = (tx: Parameters<typeof auditService.record>[0]) =>
    auditService.record(tx, {
      serverId,
      actorId: userId,
      action: admin ? "admin_grant" : "admin_revoke",
      targetUserId: member.userId,
    });
  if (!admin) {
    await prisma.$transaction(async (tx) => {
      await tx.memberRole.deleteMany({ where: { memberId, roleId: { in: adminRoles.map((r) => r.id) } } });
      await audit(tx);
    });
    return;
  }
  const role =
    adminRoles.find((r) => r.name === ADMIN_ROLE_NAME) ??
    (await prisma.role.create({
      data: { serverId, name: ADMIN_ROLE_NAME, permissions: PERMISSIONS.ADMINISTRATOR },
    }));
  await prisma.$transaction(async (tx) => {
    await tx.memberRole.upsert({
      where: { memberId_roleId: { memberId, roleId: role.id } },
      create: { memberId, roleId: role.id },
      update: {},
    });
    await audit(tx);
  });
}

export async function unassign(serverId: string, roleId: string, memberId: string, userId: string) {
  const role = await getRole(serverId, roleId);
  await requireGrantable(serverId, userId, toNames(role.permissions));
  const member = await serversService.getMemberById(serverId, memberId);
  await prisma.$transaction(async (tx) => {
    await tx.memberRole.deleteMany({ where: { memberId, roleId } });
    await auditService.record(tx, {
      serverId,
      actorId: userId,
      action: "role_remove",
      targetUserId: member.userId,
      details: { roleId, roleName: role.name },
    });
  });
}
