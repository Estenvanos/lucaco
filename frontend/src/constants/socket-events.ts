/** Mirrors backend/src/lib/constants.ts — keep both sides in sync. */
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
  messageSend: "message:send",
  messageNew: "message:new",
  messageTyping: "message:typing",
  notificationNew: "notification:new",
  notificationRemoved: "notification:removed",
} as const;
