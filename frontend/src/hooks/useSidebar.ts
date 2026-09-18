import { useState, type ChangeEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { ROUTES } from "../constants/routes";
import { useServers } from "../services/servers/servers.api";

/** Everything the sidebar needs to hold: the filter box and whether the add dialog is open. */
export function useSidebar() {
  const { data: servers = [] } = useServers();
  const { serverId = null } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const term = query.trim().toLowerCase();
  // Filtering is local: the API only lists the servers this user already belongs to.
  const visible = term ? servers.filter((s) => s.name.toLowerCase().includes(term)) : servers;

  return {
    servers: visible,
    activeServerId: serverId,
    query,
    onQueryChange: (event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    adding,
    openAdd: () => setAdding(true),
    closeAdd: () => setAdding(false),
    openServer: (id: string) => navigate(ROUTES.server(id)),
  };
}
