import { useNavigate } from "react-router";
import { ROUTES } from "../constants/routes";
import { useFriends } from "../services/friends/friends.api";
import { useConversations } from "../services/messages/messages.api";
import { useServers } from "../services/servers/servers.api";
import { useMe } from "../services/users/users.api";
import { useUnread } from "./useUnread";

/** The home page: the user's servers and the friends they already talked to. */
export function useHomePage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: servers = [] } = useServers();
  const { data: allConversations = [] } = useConversations(me?.id);
  const { data: friends = [] } = useFriends();
  const unread = useUnread();

  // Friends only: a conversation with someone who unfriended stays out of the home. Order comes from the API.
  const friendIds = new Set(friends.map((f) => f.userId));
  const conversations = allConversations.filter((c) => friendIds.has(c.peer.id));

  return {
    me,
    servers,
    conversations,
    unread,
    openServer: (serverId: string) => navigate(ROUTES.server(serverId)),
    openConversation: (userId: string) => navigate(ROUTES.conversation(userId)),
    openDiscover: () => navigate(ROUTES.discover),
    openNewServer: () => navigate(ROUTES.newServer),
  };
}
