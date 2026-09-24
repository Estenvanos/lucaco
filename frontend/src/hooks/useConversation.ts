import { ApiError } from "../lib/api";
import { alertError, chatRows, confirmDelete, messagePreview, nameOf } from "../lib/utils";
import { useFriends } from "../services/friends/friends.api";
import { deleteMessage, reactMessage, sendMessage, useChat } from "../services/messages/messages.api";
import { messagesKeys } from "../services/messages/messages.keys";
import { uploadAttachment, uploadVoice } from "../services/messages/messages.media";
import { sendTyping, useChatLive } from "../services/messages/messages.socket";
import type { ChatRow } from "../types/messages.types";
import type { ChatPerson } from "../types/ui.types";
import { useAttacher } from "./useAttacher";
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
  const composer = useComposer((out, answerFor) => sendMessage(me.id, peerId, out, answerFor));
  // Voice and files answer the same message the text box would, then clear it.
  const voice = useVoiceRecorder(me.settings, async (recording, durationMs) => {
    const audio = await uploadVoice({ peerId }, recording, durationMs);
    await sendMessage(me.id, peerId, { text: "", audio, attachment: null }, composer.replyTo?.id);
    composer.cancelReply();
  });
  const attacher = useAttacher(async (file, thumb) => {
    const attachment = await uploadAttachment({ peerId }, file, thumb);
    await sendMessage(me.id, peerId, { text: "", audio: null, attachment }, composer.replyTo?.id);
    composer.cancelReply();
  });

  const messages = chat.data?.pages.flatMap((page) => page.messages) ?? [];
  const peerName = peer ? (peer.displayName ?? peer.username) : "";
  const authorOf = (senderId: string): ChatPerson => (senderId === me.id || !peer ? me : peer);
  const { replyTo } = composer;

  return {
    me,
    peer,
    notFriend: !friendsLoading && !peer,
    rows: chatRows(messages),
    authorOf,
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
    /** In a DM only the author may delete. */
    canDelete: (row: ChatRow) => row.senderId === me.id,
    onDelete: (row: ChatRow) => confirmDelete(() => deleteMessage(messagesKeys.chat(peerId), row.id, peerId)),
    meId: me.id,
    onReply: composer.reply,
    onReact: (row: ChatRow, emoji: string) => reactMessage(messagesKeys.chat(peerId), row.id, emoji, peerId).catch(alertError),
    composer: {
      ...composer,
      replying: replyTo && { id: replyTo.id, name: nameOf(authorOf(replyTo.senderId)), preview: messagePreview(replyTo) },
      placeholder: `Conversar com @${peerName}`,
      label: `Mensagem para ${peerName}`,
      voice,
      attacher,
      onInput: () => sendTyping(peerId),
    },
  };
}
