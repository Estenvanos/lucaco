import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../constants/routes";
import { ApiError } from "../lib/api";
import { addFriendSchema } from "../schemas/friends.schema";
import { useAcceptFriend, useDeclineFriend, useSendFriendRequest, useSentRequests } from "../services/friends/friends.api";
import { NOTIFICATION_TAGS } from "../constants/notifications";
import { useConversations } from "../services/messages/messages.api";
import { useNotifications } from "../services/notifications/notifications.api";
import type { FriendsTab } from "../types/friends.types";
import { useUnread } from "./useUnread";
import { useZodForm } from "./useZodForm";

/** The friends page: which tab is open, the add-friend form and the inbox actions. */
export function useFriendsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<FriendsTab>("add");
  // The inbox is friend requests only; everything else goes to the top bar's panel.
  const { data: inbox = [] } = useNotifications((n) => n.tag === NOTIFICATION_TAGS.friendRequest);
  const { data: sent = [] } = useSentRequests();
  const unread = useUnread();
  const { data: conversations = [] } = useConversations(tab === "conversations");
  const send = useSendFriendRequest();
  const accept = useAcceptFriend();
  const decline = useDeclineFriend();

  const [sentTo, setSentTo] = useState<string | null>(null);
  // Bumping the key remounts the form: that is the reset, no effect or controlled inputs needed.
  const [formKey, setFormKey] = useState(0);
  const [messageLength, setMessageLength] = useState(0);

  const form = useZodForm(addFriendSchema, async (input) => {
    const friendship = await send.mutateAsync(input).catch((err: unknown) => {
      // The nick must exist: say so in the page's language instead of the API's "User not found".
      if (err instanceof ApiError && err.status === 404) throw new ApiError(404, "Usuário não encontrado");
      throw err;
    });
    setSentTo(friendship.user.displayName ?? friendship.user.username);
    setMessageLength(0);
    setFormKey((key) => key + 1);
  });

  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const field = event.target as HTMLTextAreaElement;
    if (field.name === "message") setMessageLength(field.value.length);
    if (sentTo) setSentTo(null);
  };

  return {
    tab,
    setTab,
    inbox,
    sent,
    conversations,
    unread,
    openConversation: (userId: string) => navigate(ROUTES.conversation(userId)),
    add: { ...form, onChange, formKey, sentTo, messageLength, loading: send.isPending },
    busy: [accept, decline].find((m) => m.isPending)?.variables ?? null,
    // Accepting opens the conversation with the new friend right away.
    onAccept: (userId: string) =>
      accept.mutate(userId, { onSuccess: () => navigate(ROUTES.conversation(userId)) }),
    onDecline: (userId: string) => decline.mutate(userId),
    openDiscover: () => navigate(ROUTES.discover),
  };
}
