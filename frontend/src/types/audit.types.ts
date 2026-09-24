import type { AUDIT_ACTIONS } from "../constants/server-settings";
import type { UserProfile } from "./users.types";

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

type AuditPerson = Pick<UserProfile, "id" | "username" | "displayName" | "avatarUrl">;

export type AuditEntry = {
  id: string;
  action: AuditAction;
  /** null when the account was deleted. */
  actor: AuditPerson | null;
  target: AuditPerson | null;
  details: { fields?: string[]; roleName?: string; count?: number } | null;
  createdAt: string;
};

export type AuditPage = { entries: AuditEntry[]; nextCursor: string | null };
