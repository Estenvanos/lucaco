import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";
import { ENDPOINTS } from "../../constants/endpoints";
import { SOCKET_EVENTS } from "../../constants/socket-events";
import { ApiError, request } from "../../lib/api";
import { encryptText } from "../../lib/crypto";
import type { Mentions } from "../../lib/mentions";
import { queryClient } from "../../lib/query-client";
import { socket } from "../../lib/socket";
import type {
  ChatMessage,
  ChatPage,
  Conversation,
  ConversationResponse,
  HistoryResponse,
  MessageContentType,
  Outgoing,
  StoredMessage,
} from "../../types/messages.types";
import { channelKeyring, keyForEpoch } from "./messages.channel-e2e";
import { chatKey, decryptMessage } from "./messages.e2e";
import { messagesKeys } from "./messages.keys";

/** Each conversation's last message decrypted here, for the preview; no key leaves it null. */
export const useConversations = (me: string | undefined, enabled = true) =>
  useQuery({
    queryKey: messagesKeys.conversations(),
    queryFn: async (): Promise<Conversation[]> => {
      const rows = await request<ConversationResponse[]>(ENDPOINTS.messages.conversations);
      return Promise.all(
        rows.map(async ({ lastMessage, ...row }) => ({
          ...row,
          lastMessage: await chatKey(me!, row.peer.id)
            .then((key) => decryptMessage(key, lastMessage))
            .catch(() => null),
        })),
      );
    },
    enabled: enabled && !!me,
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

/** Server channel history: each message opens with the key of the epoch it names. */
export const useChannelChat = (me: string, channelId: string) =>
  useInfiniteQuery({
    queryKey: messagesKeys.channel(channelId),
    queryFn: async ({ pageParam }): Promise<ChatPage> => {
      await channelKeyring(me, channelId); // creates or joins the epoch before the first send
      const page = await request<HistoryResponse>(ENDPOINTS.messages.channelHistory(channelId, pageParam));
      return {
        channelId,
        messages: await Promise.all(
          page.messages.map(async (m) => decryptMessage(await keyForEpoch(me, channelId, m.keyEpoch), m)),
        ),
        nextCursor: page.nextCursor,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: Infinity,
    refetchOnMount: "always",
    retry: false,
  });

/** Puts a message at the newest end of an open chat, once (ack and broadcast both deliver it). */
export function addToCache(queryKey: readonly unknown[], message: ChatMessage) {
  queryClient.setQueryData<InfiniteData<ChatPage>>(queryKey, (data) => {
    if (!data || data.pages.some((p) => p.messages.some((m) => m.id === message.id))) return data;
    const [first, ...rest] = data.pages;
    return { ...data, pages: [{ ...first, messages: [message, ...first.messages] }, ...rest] };
  });
}

export const addToChat = (peerId: string, message: ChatMessage) => addToCache(messagesKeys.chat(peerId), message);

const sealed = (key: CryptoKey, out: Outgoing) =>
  encryptText(key, out.audio ?? out.attachment ? JSON.stringify(out.audio ?? out.attachment) : out.text);

const contentType = (out: Outgoing): MessageContentType => (out.audio ? "audio" : (out.attachment?.kind ?? "text"));

/** The file's id in the clear, so the API can delete it together with the message. */
const mediaId = (out: Outgoing) => out.audio?.mediaId ?? out.attachment?.mediaId;

async function emit(payload: object) {
  const ack = await socket
    .timeout(10_000)
    .emitWithAck(SOCKET_EVENTS.messageSend, { clientMessageId: crypto.randomUUID(), ...payload });
  if ("error" in ack) throw new ApiError(400, String(ack.error));
  return ack as StoredMessage;
}

/** Encrypts in the browser and sends through the user's socket; the server only sees ciphertext. */
export async function sendMessage(me: string, peerId: string, out: Outgoing) {
  const key = await chatKey(me, peerId);
  const stored = await emit({ peerId, contentType: contentType(out), mediaId: mediaId(out), ...(await sealed(key, out)) });
  addToChat(peerId, { id: stored.id, senderId: me, ...out, createdAt: stored.createdAt });
  queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });
}

/** Same for a server channel, with the current epoch key; a rotation in between retries once. */
export async function sendChannelMessage(
  me: string,
  channelId: string,
  out: Outgoing,
  mentions?: Mentions,
  retry = true,
): Promise<void> {
  const ring = await channelKeyring(me, channelId, !retry);
  try {
    const stored = await emit({
      channelId,
      keyEpoch: ring.current,
      contentType: contentType(out),
      mediaId: mediaId(out),
      mentions,
      ...(await sealed(ring.keys.get(ring.current)!, out)),
    });
    addToCache(messagesKeys.channel(channelId), { id: stored.id, senderId: me, ...out, createdAt: stored.createdAt });
  } catch (err) {
    // The API's 409 for a message sealed with an epoch someone just rotated away from.
    if (retry && err instanceof ApiError && err.message === "Stale key epoch") return sendChannelMessage(me, channelId, out, mentions, false);
    throw err;
  }
}

/** Drops a message from an open chat, once (the ack and the broadcast both deliver it). */
export function removeFromCache(queryKey: readonly unknown[], messageId: string) {
  queryClient.setQueryData<InfiniteData<ChatPage>>(queryKey, (data) =>
    data && {
      ...data,
      pages: data.pages.map((p) => ({ ...p, messages: p.messages.filter((m) => m.id !== messageId) })),
    },
  );
}

/**
 * Deletes for real (the API removes the message and its file, then tells everyone who can read
 * it). `peerId` is needed in a DM only. The chat updates when the ack arrives.
 */
export async function deleteMessage(queryKey: readonly unknown[], messageId: string, peerId?: string) {
  const ack = await socket.timeout(10_000).emitWithAck(SOCKET_EVENTS.messageDelete, { messageId, peerId });
  if ("error" in ack) throw new ApiError(400, String(ack.error));
  removeFromCache(queryKey, messageId);
}
