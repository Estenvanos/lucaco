import { useParams } from "react-router";
import { SERVER_SETTINGS_SECTIONS } from "../constants/server-settings";
import { useServerPermissions, useServers } from "../services/servers/servers.api";

/**
 * The server and the tabs the user may open, from the URL. A tab the user cannot see (or an
 * unknown one) falls back to the first allowed tab; none allowed = null.
 */
export function useServerSettings() {
  const { serverId = "", section } = useParams();
  const { data: servers = [], isPending } = useServers();
  const { data: permissions = [], isPending: permissionsPending } = useServerPermissions(serverId);
  const sections = SERVER_SETTINGS_SECTIONS.filter((s) => s.permissions.some((p) => permissions.includes(p)));

  return {
    server: servers.find((s) => s.id === serverId) ?? null,
    permissions,
    sections,
    active: sections.find((s) => s.id === section)?.id ?? sections[0]?.id ?? null,
    loading: isPending || permissionsPending,
  };
}
