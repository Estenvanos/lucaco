import { useState, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { ROUTES } from "../constants/routes";
import { useServers } from "../services/servers/servers.api";
import type { Point } from "../types/ui.types";

/** Everything the sidebar needs to hold: where search opened from. */
export function useSidebar() {
  const { data: servers = [] } = useServers();
  const { serverId = null } = useParams();
  const navigate = useNavigate();
  const [searchOrigin, setSearchOrigin] = useState<Point | null>(null);

  return {
    servers,
    activeServerId: serverId,
    openDiscover: () => navigate(ROUTES.discover),
    searchOrigin,
    // The dialog grows out of the button, so remember where the button's centre is.
    openSearch: (event: MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setSearchOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    },
    closeSearch: () => setSearchOrigin(null),
    openServer: (id: string) => navigate(ROUTES.server(id)),
  };
}
