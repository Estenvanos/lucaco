import type { InfiniteData } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { SOCKET_EVENTS } from "../../constants/socket-events";
import { queryClient } from "../../lib/query-client";
import { holdSocket, socket } from "../../lib/socket";
import type { ChatPage, StoredMessage } from "../../types/messages.types";
import { addToCache, addToChat, markRead } from "./messages.api";
import { keyForEpoch } from "./messages.channel-e2e";
import { chatKey, decryptMessage } from "./messages.e2e";
import { messagesKeys } from "./messages.keys";

/** The sender repeats "typing" every TYPING_EVERY ms; the receiver shows it for TYPING_SHOW ms. */
const TYPING_EVERY = 2000;
const TYPING_SHOW = 3500;

const typing = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

function stopTyping(userId: string) {
  clearTimeout(typing.get(userId));
  if (typing.delete(userId)) changed();
}

function onTyping({ userId }: { userId: string }) {
  clearTimeout(typing.get(userId));
  typing.set(userId, setTimeout(() => stopTyping(userId), TYPING_SHOW));
  changed();
}

/**
 * One subscribe function per chat, kept stable across renders (a new function would make React
 * resubscribe on every render). It feeds new messages into the chat cache and tracks typing.
 */
const subscriptions = new Map<string, (notify: () => void) => () => void>();

function chatSubscription(me: string, peerId: string) {
  const id = `${me}:${peerId}`;
  let subscribe = subscriptions.get(id);
  if (subscribe) return subscribe;

  const onMessage = async (message: StoredMessage) => {
    // Only this conversation: the cached history knows its channel id.
    const data = queryClient.getQueryData<InfiniteData<ChatPage>>(messagesKeys.chat(peerId));
    if (data?.pages[0]?.channelId !== message.channelId) return;
    if (message.senderId === peerId) {
      stopTyping(peerId);
      markRead(peerId); // it is on screen, so it is read
    }
    addToChat(peerId, await decryptMessage(await chatKey(me, peerId), message));
  };

  subscribe = (notify: () => void) => {
    listeners.add(notify);
    socket.on(SOCKET_EVENTS.messageTyping, onTyping);
    socket.on(SOCKET_EVENTS.messageNew, onMessage);
    const release = holdSocket();
    return () => {
      listeners.delete(notify);
      socket.off(SOCKET_EVENTS.messageTyping, onTyping);
      socket.off(SOCKET_EVENTS.messageNew, onMessage);
      release();
    };
  };
  subscriptions.set(id, subscribe);
  return subscribe;
}

/** Keeps the open chat live. Returns whether the peer is typing right now. */
export const useChatLive = (me: string, peerId: string) =>
  useSyncExternalStore(chatSubscription(me, peerId), () => typing.has(peerId));

let lastTyping = 0;

/** Called on every keystroke; actually emits at most once per TYPING_EVERY. */
export function sendTyping(peerId: string) {
  const now = Date.now();
  if (now - lastTyping < TYPING_EVERY) return;
  lastTyping = now;
  socket.emit(SOCKET_EVENTS.messageTyping, { peerId });
}

const channelSubscriptions = new Map<string, (notify: () => void) => () => void>();

/** Same as chatSubscription for a server channel: decrypts with the message's epoch key. */
function channelSubscription(me: string, channelId: string) {
  let subscribe = channelSubscriptions.get(channelId);
  if (subscribe) return subscribe;

  const onMessage = async (message: StoredMessage) => {
    if (message.channelId !== channelId) return;
    const key = await keyForEpoch(me, channelId, message.keyEpoch);
    addToCache(messagesKeys.channel(channelId), await decryptMessage(key, message));
  };

  subscribe = () => {
    socket.on(SOCKET_EVENTS.messageNew, onMessage);
    const release = holdSocket();
    return () => {
      socket.off(SOCKET_EVENTS.messageNew, onMessage);
      release();
    };
  };
  channelSubscriptions.set(channelId, subscribe);
  return subscribe;
}

/** Keeps the open channel live. ponytail: no typing indicator in channels yet. */
export const useChannelLive = (me: string, channelId: string) =>
  useSyncExternalStore(channelSubscription(me, channelId), () => null);
