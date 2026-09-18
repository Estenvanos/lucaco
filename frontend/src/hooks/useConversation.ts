import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiError } from "../lib/api";
import { chatRows } from "../lib/utils";
import { useFriends } from "../services/friends/friends.api";
import { sendMessage, useChat } from "../services/messages/messages.api";
import { sendTyping, useChatLive } from "../services/messages/messages.socket";
import { useAuth } from "./useAuth";

/** The chat with one friend: decrypted history, live updates, typing and the composer. */
export function useConversation(peerId: string) {
  const me = useAuth().user!;
  const { data: friends = [], isPending: friendsLoading } = useFriends();
  const peer = friends.find((f) => f.user.id === peerId)?.user ?? null;
  const chat = useChat(me.id, peerId);
  const peerTyping = useChatLive(me.id, peerId);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messages = chat.data?.pages.flatMap((page) => page.messages) ?? [];

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = String(new FormData(form).get("text") ?? "").trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    sendMessage(me.id, peerId, text)
      .then(() => form.reset())
      .catch((err: unknown) => setSendError(err instanceof ApiError ? err.message : "Mensagem não enviada"))
      .finally(() => setSending(false));
  };

  return {
    me,
    peer,
    notFriend: !friendsLoading && !peer,
    rows: chatRows(messages),
    loading: chat.isPending,
    loadError: chat.error instanceof ApiError ? chat.error.message : chat.error ? "Não foi possível abrir a conversa" : null,
    hasOlder: chat.hasNextPage,
    loadingOlder: chat.isFetchingNextPage,
    loadOlder: () => chat.fetchNextPage(),
    peerTyping,
    composer: {
      sending,
      error: sendError,
      onSubmit,
      onInput: () => sendTyping(peerId),
      // Enter sends, Shift+Enter breaks the line.
      onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }
      },
    },
  };
}
