import { useSyncExternalStore } from "react";
import { NOTIFICATION_TAGS } from "../../constants/notifications";
import { SOCKET_EVENTS } from "../../constants/socket-events";
import { queryClient } from "../../lib/query-client";
import { holdSocket, socket } from "../../lib/socket";
import type { AppNotification } from "../../types/notifications.types";
import { friendsKeys } from "../friends/friends.keys";
import { messagesKeys } from "../messages/messages.keys";
import { serversKeys } from "../servers/servers.keys";
import { notificationsKeys } from "./notifications.keys";

const setList = (update: (list: AppNotification[]) => AppNotification[]) =>
  queryClient.setQueryData<AppNotification[]>(notificationsKeys.list(), (list) => list && update(list));

function onNew(notification: AppNotification) {
  setList((list) => [notification, ...list.filter((n) => n.id !== notification.id)]);
  // Someone accepted: they are a friend now, so the wheel's list is stale.
  if (notification.tag === NOTIFICATION_TAGS.friendAccepted) {
    queryClient.invalidateQueries({ queryKey: friendsKeys.all });
  }
}

const onRemoved = ({ id }: { id: string }) => setList((list) => list.filter((n) => n.id !== id));

// Any message, any chat: the Conversas list order and membership may have changed.
const onMessage = () => queryClient.invalidateQueries({ queryKey: messagesKeys.conversations() });

// Kicked or banned: the server leaves the list, and the server page redirects once it is gone.
const onServerRemoved = () => queryClient.invalidateQueries({ queryKey: serversKeys.all });

// Events sent while the socket was down are lost: refetch on every (re)connect.
const onConnect = () => queryClient.invalidateQueries({ queryKey: notificationsKeys.all });

function subscribe(notify: () => void) {
  socket.on(SOCKET_EVENTS.notificationNew, onNew);
  socket.on(SOCKET_EVENTS.notificationRemoved, onRemoved);
  socket.on(SOCKET_EVENTS.messageNew, onMessage);
  socket.on(SOCKET_EVENTS.serverRemoved, onServerRemoved);
  socket.on("connect", onConnect);
  socket.on("connect", notify);
  socket.on("disconnect", notify);
  const release = holdSocket();
  return () => {
    socket.off(SOCKET_EVENTS.notificationNew, onNew);
    socket.off(SOCKET_EVENTS.notificationRemoved, onRemoved);
    socket.off(SOCKET_EVENTS.messageNew, onMessage);
    socket.off(SOCKET_EVENTS.serverRemoved, onServerRemoved);
    socket.off("connect", onConnect);
    socket.off("connect", notify);
    socket.off("disconnect", notify);
    release();
  };
}

/** Keeps the notifications cache live while mounted. Returns whether the socket is connected. */
export const useNotificationsLive = () => useSyncExternalStore(subscribe, () => socket.connected);
