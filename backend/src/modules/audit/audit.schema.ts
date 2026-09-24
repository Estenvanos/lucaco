import { z } from "zod";

/** What the audit log records. The frontend mirrors this list with labels. */
export const AUDIT_ACTIONS = [
  "server_update",
  "member_kick",
  "member_ban",
  "member_unban",
  "role_add",
  "role_remove",
  "admin_grant",
  "admin_revoke",
  "rules_update",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_PAGE_SIZE = 50;

export const auditParamsSchema = z.object({
  serverId: z.string().uuid(),
});

export const listAuditSchema = z.object({
  /** Cursor: createdAt of the last entry already shown. */
  before: z.coerce.date().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
});

export type ListAuditInput = z.infer<typeof listAuditSchema>;

export type AuditEntry = {
  serverId: string;
  actorId: string;
  action: AuditAction;
  targetUserId?: string | null;
  details?: Record<string, unknown>;
};
