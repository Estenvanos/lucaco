import type { Prisma } from "../../generated/prisma/client.js";
import { withUser } from "../../lib/prisma.js";
import * as serversService from "../servers/servers.services.js";
import * as usersService from "../users/users.services.js";
import { AUDIT_PAGE_SIZE, type AuditEntry, type ListAuditInput } from "./audit.schema.js";

/**
 * Appends an entry using the caller's client, so it commits or rolls back with the action.
 * createMany, not create: create reads the row back (INSERT ... RETURNING), which RLS refuses to
 * someone who may write the log but not read it (no VIEW_AUDIT_LOG).
 */
export async function record(
  db: Prisma.TransactionClient,
  { serverId, actorId, action, targetUserId, details }: AuditEntry,
) {
  await db.auditLog.createMany({
    data: [{ serverId, actorId, action, targetUserId: targetUserId ?? null, details: details as Prisma.InputJsonValue }],
  });
}

/** Newest first, AUDIT_PAGE_SIZE at a time; nextCursor is null on the last page. */
export async function list(serverId: string, userId: string, { before, action }: ListAuditInput) {
  await serversService.requirePermission(serverId, userId, "VIEW_AUDIT_LOG");
  const rows = await withUser(userId, (tx) =>
    tx.auditLog.findMany({
      where: { serverId, ...(action && { action }), ...(before && { createdAt: { lt: before } }) },
      orderBy: { createdAt: "desc" },
      take: AUDIT_PAGE_SIZE,
    }),
  );
  const ids = rows.flatMap((r) => [r.actorId, r.targetUserId]).filter((id): id is string => !!id);
  const profiles = await usersService.getProfiles([...new Set(ids)]);
  return {
    entries: rows.map((row) => ({
      id: row.id,
      action: row.action,
      actor: row.actorId ? (profiles.get(row.actorId) ?? null) : null,
      target: row.targetUserId ? (profiles.get(row.targetUserId) ?? null) : null,
      details: row.details,
      createdAt: row.createdAt,
    })),
    nextCursor: rows.length === AUDIT_PAGE_SIZE ? rows.at(-1)!.createdAt : null,
  };
}
