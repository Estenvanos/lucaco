import { ApiError } from "../lib/api";
import { chatRows } from "../lib/utils";
import { useFriends } from "../services/friends/friends.api";
import { sendMessage, useChat } from "../services/messages/messages.api";
import { uploadVoice } from "../services/messages/messages.media";
import { sendTyping, useChatLive } from "../services/messages/messages.socket";
import type { ChatPerson } from "../types/ui.types";
import { useAuth } from "./useAuth";
import { useComposer } from "./useComposer";
import { useVoiceRecorder } from "./useVoiceRecorder";

/** The chat with one friend: decrypted history, live updates, typing and the composer. */
export function useConversation(peerId: string) {
  const me = useAuth().user!;
  const { data: friends = [], isPending: friendsLoading } = useFriends();
  const peer = friends.find((f) => f.user.id === peerId)?.user ?? null;
  const chat = useChat(me.id, peerId);
  const peerTyping = useChatLive(me.id, peerId);
  const composer = useComposer((out) => sendMessage(me.id, peerId, out));
  const voice = useVoiceRecorder(me.settings.audioInputId, async (recording, durationMs) => {
    const audio = await uploadVoice({ peerId }, recording, durationMs);
    await sendMessage(me.id, peerId, { text: "", audio });
  });

  const messages = chat.data?.pages.flatMap((page) => page.messages) ?? [];
  const peerName = peer ? (peer.displayName ?? peer.username) : "";

  return {
    me,
    peer,
    notFriend: !friendsLoading && !peer,
    rows: chatRows(messages),
    authorOf: (senderId: string): ChatPerson => (senderId === me.id || !peer ? me : peer),
    intro: {
      title: peerName,
      text: `Este é o começo da sua conversa com @${peer?.username ?? ""}. Só vocês dois conseguem ler.`,
    },
    loading: chat.isPending,
    loadError: chat.error instanceof ApiError ? chat.error.message : chat.error ? "Não foi possível abrir a conversa" : null,
    hasOlder: chat.hasNextPage,
    loadingOlder: chat.isFetchingNextPage,
    loadOlder: () => chat.fetchNextPage(),
    peerTyping,
    composer: {
      ...composer,
      placeholder: `Conversar com @${peerName}`,
      label: `Mensagem para ${peerName}`,
      voice,
      onInput: () => sendTyping(peerId),
    },
  };
}
