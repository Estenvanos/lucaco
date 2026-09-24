/** Values shared by more than one module. Module-only constants stay in the module. */

import type { NotificationTag } from "../generated/prisma/client.js";

/** Most people a voice channel can hold; the per-channel limit (Channel.userLimit) goes up to this. */
export const VOICE_MAX_USERS = 12;

/** Socket event names. The frontend mirrors this list in constants/socket-events.ts. */
export const SOCKET_EVENTS = {
  voiceJoin: "voice:join",
  voiceLeave: "voice:leave",
  voiceSignal: "voice:signal",
  voiceScreen: "voice:screen",
  voicePeerJoined: "voice:peer-joined",
  voicePeerLeft: "voice:peer-left",
  voiceWatch: "voice:watch",
  voiceUnwatch: "voice:unwatch",
  voiceParticipants: "voice:participants",
  voiceStreamWatch: "voice:stream-watch",
  voiceStreamUnwatch: "voice:stream-unwatch",
  voiceViewer: "voice:viewer",
  messageSend: "message:send",
  messageNew: "message:new",
  messageDelete: "message:delete",
  /** To everyone who can read the conversation: { id, channelId } left it. */
  messageDeleted: "message:deleted",
  messageTyping: "message:typing",
  messageReact: "message:react",
  /** To everyone who can read the conversation: { id, channelId, reactions } after a toggle. */
  messageReacted: "message:reacted",
  notificationNew: "notification:new",
  notificationRemoved: "notification:removed",
  /** To a kicked or banned user: the server left their list. */
  serverRemoved: "server:removed",
} as const;

/**
 * Notification tags (the `notification_tag` enum in Postgres). `satisfies` breaks the build if
 * this list and the Prisma enum drift apart. The frontend mirrors it in constants/notifications.ts.
 */
export const NOTIFICATION_TAGS = {
  friendRequest: "friend_request",
  friendAccepted: "friend_accepted",
  /** One per sender while unread: the red dot on the friend, cleared when the chat is opened. */
  newMessage: "new_message",
  /** @name / @todos in a server channel. */
  mention: "mention",
  /** Someone replied to / reacted on the receiver's message (DM or channel). */
  reply: "reply",
  reaction: "reaction",
  /** To administrators: someone joined, left, was kicked or banned. */
  serverActivity: "server_activity",
} as const satisfies Record<string, NotificationTag>;

/** Refresh cookie: scoped to /auth so it is never sent to the rest of the API. */
export const REFRESH_COOKIE = "refresh_token";
export const REFRESH_COOKIE_PATH = "/auth";

export const JSON_BODY_LIMIT = "100kb";

/**
 * Server permissions as a bitfield (BIGINT in Postgres, BigInt in JS).
 * A member's permissions are the OR of every role they hold, including @everyone.
 */
export const PERMISSIONS = {
  VIEW_CHANNELS: 1n << 0n,
  SEND_MESSAGES: 1n << 1n,
  MANAGE_MESSAGES: 1n << 2n,
  CONNECT: 1n << 3n, // join the voice channel
  SPEAK: 1n << 4n,
  STREAM: 1n << 5n, // share a tab
  MANAGE_ROLES: 1n << 6n,
  MANAGE_SERVER: 1n << 7n,
  KICK_MEMBERS: 1n << 8n,
  ADMINISTRATOR: 1n << 9n, // implies every other permission
  MANAGE_CHANNELS: 1n << 10n, // create, edit and delete channels
  SEND_VOICE_MESSAGES: 1n << 11n, // recorded audio in a text channel
  BAN_MEMBERS: 1n << 12n, // remove a member for good
  ATTACH_FILES: 1n << 13n, // images, documents and videos in a text channel
  VIEW_AUDIT_LOG: 1n << 14n, // read the server's audit log
} as const;

export type PermissionName = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).reduce((acc, bit) => acc | bit, 0n);

/**
 * What a channel overwrite may touch. MANAGE_ROLES on a channel means "edit this channel's
 * permissions". The frontend mirrors this list in constants/permissions.ts.
 */
export const CHANNEL_PERMISSIONS = [
  "VIEW_CHANNELS",
  "MANAGE_CHANNELS",
  "MANAGE_ROLES",
  "SEND_MESSAGES",
  "SEND_VOICE_MESSAGES",
  "ATTACH_FILES",
  "CONNECT",
  "SPEAK",
  "STREAM",
] as const satisfies readonly PermissionName[];

/** What @everyone gets on a new server: talk, listen, share, nothing administrative. */
export const DEFAULT_PERMISSIONS =
  PERMISSIONS.VIEW_CHANNELS |
  PERMISSIONS.SEND_MESSAGES |
  PERMISSIONS.SEND_VOICE_MESSAGES |
  PERMISSIONS.ATTACH_FILES |
  PERMISSIONS.CONNECT |
  PERMISSIONS.SPEAK |
  PERMISSIONS.STREAM;

/** Discovery categories a server can pick. The frontend mirrors this list with labels. */
export const SERVER_CATEGORIES = [
  "gaming",
  "music",
  "entertainment",
  "science_tech",
  "education",
  "student_hubs",
  "other",
] as const;

export type ServerCategory = (typeof SERVER_CATEGORIES)[number];
