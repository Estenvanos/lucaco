import { useState, type MouseEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { ROUTES } from "../constants/routes";
import { useFriends } from "../services/friends/friends.api";
import { useNotificationsLive } from "../services/notifications/notifications.socket";
import { useServers } from "../services/servers/servers.api";
import type { Point, SidebarMode, WheelEntry } from "../types/ui.types";
import { useUnread } from "./useUnread";

/** Everything the sidebar needs to hold: the list mode and where search opened from. */
export function useSidebar() {
  const { serverId = null, userId = null } = useParams();
  // Opening a DM link lands in friends mode; after that the switch owns it.
  const [mode, setMode] = useState<SidebarMode>(userId ? "friends" : "servers");
  const { data: servers = [] } = useServers();
  const { data: friends = [] } = useFriends(mode === "friends");
  const navigate = useNavigate();
  // The sidebar lives as long as the session, so it holds the user's socket open.
  useNotificationsLive();
  const [searchOrigin, setSearchOrigin] = useState<Point | null>(null);

  const unread = useUnread();
  const friendEntries: WheelEntry[] = friends.map(({ user }) => ({
    id: user.id,
    name: user.displayName ?? user.username,
    iconUrl: user.avatarUrl,
    unread: unread.has(user.id),
  }));

  return {
    mode,
    toggleMode: () => setMode(mode === "servers" ? "friends" : "servers"),
    entries: mode === "servers" ? servers : friendEntries,
    activeId: mode === "servers" ? serverId : userId,
    openDiscover: () => navigate(ROUTES.discover),
    openFriends: () => navigate(ROUTES.friends),
    searchOrigin,
    // The dialog grows out of the button, so remember where the button's centre is.
    openSearch: (event: MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setSearchOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    },
    closeSearch: () => setSearchOrigin(null),
    openServer: (id: string) => navigate(ROUTES.server(id)),
    openEntry: (id: string) => navigate(mode === "servers" ? ROUTES.server(id) : ROUTES.conversation(id)),
  };
}
