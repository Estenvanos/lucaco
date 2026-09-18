import { NOTIFICATION_TAGS } from "../constants/notifications";
import { useNotifications } from "../services/notifications/notifications.api";

/** Ids of friends with unread messages: one `new_message` notification per sender while unread. */
export function useUnread() {
  const { data = [] } = useNotifications((n) => n.tag === NOTIFICATION_TAGS.newMessage);
  return new Set(data.map((n) => n.owner.id));
}
