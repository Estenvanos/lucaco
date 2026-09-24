import type { PermissionName, ServerSettingsSection } from "../types/servers.types";

/** Server settings tabs, in menu order. A tab shows when the user holds any of its permissions. */
export const SERVER_SETTINGS_SECTIONS: { id: ServerSettingsSection; label: string; permissions: PermissionName[] }[] = [
  { id: "perfil", label: "Perfil do server", permissions: ["MANAGE_SERVER"] },
  { id: "regras", label: "Regras", permissions: ["MANAGE_SERVER"] },
  { id: "membros", label: "Membros", permissions: ["KICK_MEMBERS", "BAN_MEMBERS", "MANAGE_ROLES"] },
  { id: "auditoria", label: "Registro de auditoria", permissions: ["VIEW_AUDIT_LOG"] },
];

/** Mirrors AUDIT_ACTIONS in the API (audit.schema.ts). */
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

/** Verb shown between who acted and who it touched: "ana expulsou bruno". */
export const AUDIT_ACTION_LABEL: Record<(typeof AUDIT_ACTIONS)[number], string> = {
  server_update: "alterou o server",
  member_kick: "expulsou",
  member_ban: "baniu",
  member_unban: "desbaniu",
  role_add: "deu cargo a",
  role_remove: "tirou cargo de",
  admin_grant: "tornou admin",
  admin_revoke: "removeu admin de",
  rules_update: "atualizou as regras",
};

/** Server columns named in server_update details. */
export const SERVER_FIELD_LABEL: Record<string, string> = {
  name: "nome",
  description: "descrição",
  tag: "tag",
  visibility: "visibilidade",
  category: "categoria",
  iconUrl: "ícone",
  bannerUrl: "banner",
};
