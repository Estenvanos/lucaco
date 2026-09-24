import { useDeferredValue, useState } from "react";
import { ApiError } from "../lib/api";
import { normalizeSearch } from "../lib/utils";
import {
  useBanMember,
  useBans,
  useKickMember,
  useMembers,
  useRoles,
  useSetAdmin,
  useToggleRole,
  useUnban,
} from "../services/servers/servers.api";
import type { PermissionName, PublicServer, ServerMember } from "../types/servers.types";
import { useAuth } from "./useAuth";

/**
 * Members tab: search, roles, admin, kick, ban and the ban list. The flags mirror
 * useUserActions (nobody touches the owner; only the owner touches an admin); the API re-checks all.
 */
export function useServerMembers(server: PublicServer, permissions: PermissionName[]) {
  const me = useAuth().user!;
  const [search, setSearch] = useState("");
  const query = normalizeSearch(useDeferredValue(search));
  const canBan = permissions.includes("BAN_MEMBERS");
  const { data: members = [], isPending } = useMembers(server.id);
  const { data: roles = [] } = useRoles(server.id);
  const { data: bans = [] } = useBans(server.id, canBan);
  const kick = useKickMember(server.id);
  const ban = useBanMember(server.id);
  const unban = useUnban(server.id);
  const setAdmin = useSetAdmin(server.id);
  const toggleRole = useToggleRole(server.id);
  const mutations = [kick, ban, unban, setAdmin, toggleRole];
  const error = mutations.find((m) => m.error)?.error;

  const iAmOwner = server.ownerId === me.id;
  const nameOf = (m: ServerMember) => m.nickname ?? m.displayName ?? m.username;
  const removable = (m: ServerMember) =>
    m.userId !== me.id && m.userId !== server.ownerId && (!m.isAdmin || iAmOwner);

  return {
    search,
    setSearch,
    loading: isPending,
    members: members.filter((m) =>
      [m.username, m.displayName, m.nickname].some((name) => name && normalizeSearch(name).includes(query)),
    ),
    total: members.length,
    // @everyone applies to everyone and cannot be given or taken.
    roles: roles.filter((r) => !r.isDefault),
    bans,
    canBan,
    canManageRoles: permissions.includes("MANAGE_ROLES"),
    error: error ? (error instanceof ApiError ? error.message : "Algo deu errado") : null,
    nameOf,
    isOwner: (m: ServerMember) => m.userId === server.ownerId,
    canKick: (m: ServerMember) => removable(m) && permissions.includes("KICK_MEMBERS"),
    canBanMember: (m: ServerMember) => removable(m) && canBan,
    canSetAdmin: (m: ServerMember) => iAmOwner && m.userId !== server.ownerId,
    toggleRole: (m: ServerMember, roleId: string) =>
      toggleRole.mutate({ memberId: m.id, roleId, on: !m.roleIds.includes(roleId) }),
    toggleAdmin: (m: ServerMember) => setAdmin.mutate({ memberId: m.id, admin: !m.isAdmin }),
    // ponytail: native confirm, same as useUserActions — swap for a Modal if the look matters.
    kick: (m: ServerMember) => {
      if (confirm(`Expulsar ${nameOf(m)}? Poderá entrar de novo.`)) kick.mutate(m.userId);
    },
    ban: (m: ServerMember) => {
      if (confirm(`Banir ${nameOf(m)}? Não poderá entrar de novo.`)) ban.mutate(m.userId);
    },
    unban: (userId: string) => unban.mutate(userId),
  };
}
