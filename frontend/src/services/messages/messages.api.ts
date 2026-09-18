import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { SOCKET_EVENTS } from "../../constants/socket-events";
import { ApiError, request } from "../../lib/api";
import { encryptText } from "../../lib/crypto";
import { queryClient } from "../../lib/query-client";
import { socket } from "../../lib/socket";
import type { ChatMessage, ChatPage, Conversation, HistoryResponse, StoredMessage } from "../../types/messages.types";
import { chatKey, decryptMessage } from "./messages.e2e";
import { messagesKeys } from "./messages.keys";

export const useConversations = (enabled = true) =>
  useQuery({
    queryKey: messagesKeys.conversations(),
    queryFn: () => request<Conversation[]>(ENDPOINTS.messages.conversations),
    enabled,
  });

/** Opening the chat reads it: clears the peer's unread notice (the red dot). */
export const markRead = (peerId: string) =>
  request(ENDPOINTS.messages.read, { method: "POST", body: { peerId } }).catch(() => {});

/**
 * The chat history, decrypted as it arrives: only plaintext in memory enters the cache, the
 * ciphertext never does. Pages are newest first; `fetchNextPage` walks back in time.
 */
export const useChat = (me: string, peerId: string) =>
  useInfiniteQuery({
    queryKey: messagesKeys.chat(peerId),
    queryFn: async ({ pageParam }): Promise<ChatPage> => {
      const key = await chatKey(me, peerId);
      const page = await request<HistoryResponse>(ENDPOINTS.messages.history(peerId, pageParam));
      if (!pageParam) markRead(peerId);
      return {
        channelId: page.channelId,
        messages: await Promise.all(page.messages.map((m) => decryptMessage(key, m))),
        nextCursor: page.nextCursor,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // The socket keeps it current while open. Reopening refetches: that re-reads the chat (clears
    // the red dot) and catches what arrived while it was closed.
    staleTime: Infinity,
    refetchOnMount: "always",
    retry: false,
  });

/** Puts a message at the newest end of the open chat, once (ack and broadcast both deliver it). */
export function addToChat(peerId: string, message: ChatMessage) {
  queryClient.setQueryData<InfiniteData<ChatPage>>(messagesKeys.chat(peerId), (data) => {
    if (!data || data.pages.some((p) => p.messages.some((m) => m.id === message.id))) return data;
    const [first, ...rest] = data.pages;
    return { ...data, pages: [{ ...first, messages: [message, ...first.messages] }, ...rest] };
  });
}

/** Encrypts in the browser and sends through the user's socket; the server only sees ciphertext. */
export async function sendMessage(me: string, peerId: string, text: string) {
  const key = await chatKey(me, peerId);
  const sealed = await encryptText(key, text);
  const ack = await socket
    .timeout(10_000)
    .emitWithAck(SOCKET_EVENTS.messageSend, { peerId, clientMessageId: crypto.randomUUID(), ...sealed });
  if ("error" in ack) throw new ApiError(400, String(ack.error));
  const stored = ack as StoredMessage;
  addToChat(peerId, { id: stored.id, senderId: me, text, createdAt: stored.createdAt });
  queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });
}
