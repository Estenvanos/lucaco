import type { NOTIFICATION_TAGS } from "../constants/notifications";
import type { UserProfile } from "./users.types";

export type NotificationTag = (typeof NOTIFICATION_TAGS)[keyof typeof NOTIFICATION_TAGS];

export type AppNotification = {
  id: string;
  tag: NotificationTag;
  title: string;
  /** For a friend request, the sender's optional note. */
  subtitle: string | null;
  /** Mentions only: the channel to open. */
  serverId?: string | null;
  channelId?: string | null;
  createdAt: string;
  /** Who caused it. */
  owner: UserProfile;
};
