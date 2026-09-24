import { useState } from "react";
import { useNavigate } from "react-router";
import { NOTIFICATION_TAGS } from "../constants/notifications";
import { ROUTES } from "../constants/routes";
import { useDismissNotification, useNotifications } from "../services/notifications/notifications.api";
import type { AppNotification } from "../types/notifications.types";
import { useAuth } from "./useAuth";

/** The top bar's bell: general notifications (friend requests live in the friends inbox). */
export function useNotificationsPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { hiddenNotificationTags, notificationsMuted } = useAuth().user!.settings;
  // Hidden tags are left out here only: the data is still stored, and unread dots still use it.
  const { data: notifications = [] } = useNotifications(
    (n) => n.tag !== NOTIFICATION_TAGS.friendRequest && !hiddenNotificationTags.includes(n.tag),
  );
  // The badge counts friend requests too, even though they open in the friends inbox, not here:
  // otherwise a pending request gives no signal at all outside that page.
  const { data: countable = [] } = useNotifications((n) => !hiddenNotificationTags.includes(n.tag));
  const dismiss = useDismissNotification();

  return {
    open,
    toggle: () => setOpen(!open),
    close: () => setOpen(false),
    notifications,
    badgeCount: countable.length,
    muted: notificationsMuted,
    busy: dismiss.isPending ? dismiss.variables : null,
    onDismiss: (id: string) => dismiss.mutate(id),
    // Something in a channel opens the channel; server activity opens its audit log (a moderator
    // without VIEW_AUDIT_LOG lands on the first tab they may see); a friend who
    // accepted, wrote, replied or reacted in a DM opens the chat.
    onOpen: (notification: AppNotification) => {
      setOpen(false);
      if (notification.tag === NOTIFICATION_TAGS.serverActivity && notification.serverId) {
        navigate(ROUTES.serverSettings(notification.serverId, "auditoria"));
      } else if (notification.serverId && notification.channelId) {
        navigate(ROUTES.channel(notification.serverId, notification.channelId));
      } else if (notification.tag !== NOTIFICATION_TAGS.friendRequest) {
        navigate(ROUTES.conversation(notification.owner.id));
      }
    },
  };
}
