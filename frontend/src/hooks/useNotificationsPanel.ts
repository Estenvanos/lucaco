import { useState } from "react";
import { useNavigate } from "react-router";
import { NOTIFICATION_TAGS } from "../constants/notifications";
import { ROUTES } from "../constants/routes";
import { useDismissNotification, useNotifications } from "../services/notifications/notifications.api";
import type { AppNotification } from "../types/notifications.types";

/** The top bar's bell: general notifications (friend requests live in the friends inbox). */
export function useNotificationsPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useNotifications((n) => n.tag !== NOTIFICATION_TAGS.friendRequest);
  const dismiss = useDismissNotification();

  return {
    open,
    toggle: () => setOpen(!open),
    close: () => setOpen(false),
    notifications,
    busy: dismiss.isPending ? dismiss.variables : null,
    onDismiss: (id: string) => dismiss.mutate(id),
    // A friend who accepted or wrote: go talk to them.
    onOpen: (notification: AppNotification) => {
      setOpen(false);
      if (notification.tag === NOTIFICATION_TAGS.friendAccepted || notification.tag === NOTIFICATION_TAGS.newMessage) {
        navigate(ROUTES.conversation(notification.owner.id));
      }
    },
  };
}
