/** Mirrors backend/src/lib/constants.ts — keep both sides in sync. */
export const SOCKET_EVENTS = {
  voiceJoin: "voice:join",
  voiceLeave: "voice:leave",
  voiceSignal: "voice:signal",
  voiceScreen: "voice:screen",
} as const;
