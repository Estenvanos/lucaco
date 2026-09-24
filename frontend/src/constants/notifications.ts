/** Mirrors NOTIFICATION_TAGS in backend/src/lib/constants.ts — keep both sides in sync. */
export const NOTIFICATION_TAGS = {
  friendRequest: "friend_request",
  friendAccepted: "friend_accepted",
  newMessage: "new_message",
  mention: "mention",
  reply: "reply",
  reaction: "reaction",
  serverActivity: "server_activity",
} as const;
