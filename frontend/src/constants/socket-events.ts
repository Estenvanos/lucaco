/** Mirrors backend/src/lib/constants.ts — keep both sides in sync. */
export const SOCKET_EVENTS = {
  voiceJoin: "voice:join",
  voiceLeave: "voice:leave",
  voiceSignal: "voice:signal",
  voiceScreen: "voice:screen",
  messageSend: "message:send",
  messageNew: "message:new",
  messageTyping: "message:typing",
  notificationNew: "notification:new",
  notificationRemoved: "notification:removed",
} as const;
