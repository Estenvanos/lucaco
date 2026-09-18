/** Values shared by more than one module. Module-only constants stay in the module. */

/** Socket event names. The frontend mirrors this list in constants/socket-events.ts. */
export const SOCKET_EVENTS = {
  voiceJoin: "voice:join",
  voiceLeave: "voice:leave",
  voiceSignal: "voice:signal",
  voiceScreen: "voice:screen",
  messageSend: "message:send",
  messageNew: "message:new",
} as const;

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
} as const;

export type PermissionName = keyof typeof PERMISSIONS;

/** What @everyone gets on a new server: talk, listen, share, nothing administrative. */
export const DEFAULT_PERMISSIONS =
  PERMISSIONS.VIEW_CHANNELS |
  PERMISSIONS.SEND_MESSAGES |
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
