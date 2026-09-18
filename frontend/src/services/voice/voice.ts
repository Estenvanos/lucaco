import { useSyncExternalStore } from "react";
import { Call } from "../../call";
import { SOCKET_EVENTS } from "../../constants/socket-events";
import { holdSocket, socket } from "../../lib/socket";
import type { PeerInfo, VoiceSnapshot, VoiceStream } from "../../types/voice.types";

let snapshot: VoiceSnapshot = {
  channelId: null,
  observedChannelId: null,
  peers: [],
  participants: [],
  streams: [],
  joining: false,
  muted: false,
  deafened: false,
  sharing: false,
  status: null,
  error: null,
};
const listeners = new Set<() => void>();
let releaseSocket: (() => void) | null = null;

function publish(change: Partial<VoiceSnapshot>) {
  snapshot = { ...snapshot, ...change };
  for (const listener of listeners) listener();
}

const call = new Call(socket, {
  onPeersChange: (peers: PeerInfo[]) => publish({ peers }),
  onStream: (key, stream, label) => {
    const streams = stream
      ? [
          ...snapshot.streams.filter((item) => item.key !== key),
          { key, stream, label, hasVideo: stream.getVideoTracks().length > 0 } satisfies VoiceStream,
        ]
      : snapshot.streams.filter((item) => !item.key.startsWith(key));
    publish({ streams, ...(key === "local-screen" && { sharing: Boolean(stream) }) });
  },
  onStatus: (status) => publish({ status }),
});

const subscriptions = new Map<string, (notify: () => void) => () => void>();

function subscription(channelId: string | null) {
  const key = channelId ?? "none";
  const cached = subscriptions.get(key);
  if (cached) return cached;

  const subscribe = (notify: () => void) => {
    listeners.add(notify);
    if (!channelId) return () => listeners.delete(notify);

    let active = true;
    const onParticipants = (event: { channelId: string; participants: PeerInfo[] }) => {
      if (event.channelId === channelId) {
        publish({ observedChannelId: channelId, participants: event.participants });
      }
    };
    const watch = async () => {
      const response = await socket.emitWithAck(SOCKET_EVENTS.voiceWatch, { channelId });
      if (active && !response.error) {
        publish({ observedChannelId: channelId, participants: response.participants });
      }
    };

    socket.on(SOCKET_EVENTS.voiceParticipants, onParticipants);
    socket.on("connect", watch);
    const release = holdSocket();
    if (socket.connected) void watch();

    return () => {
      active = false;
      listeners.delete(notify);
      socket.off(SOCKET_EVENTS.voiceParticipants, onParticipants);
      socket.off("connect", watch);
      if (socket.connected) socket.emit(SOCKET_EVENTS.voiceUnwatch, { channelId });
      release();
    };
  };
  subscriptions.set(key, subscribe);
  return subscribe;
}

export const useVoice = (channelId: string | null) =>
  useSyncExternalStore(subscription(channelId), () => snapshot);

export async function joinVoice(channelId: string, audioInputId: string | null) {
  if (snapshot.channelId === channelId || snapshot.joining) return;
  publish({ joining: true, error: null, status: "Conectando ao canal de voz..." });
  try {
    if (snapshot.channelId) await leaveVoice();
    releaseSocket ??= holdSocket();
    await call.join(channelId, audioInputId);
    publish({ channelId, joining: false, muted: false, status: "Conectado ao canal de voz" });
  } catch (error) {
    releaseSocket?.();
    releaseSocket = null;
    publish({ joining: false, status: null, error: error instanceof Error ? error.message : "Não foi possível entrar" });
  }
}

export async function leaveVoice() {
  try {
    await call.leave();
  } finally {
    releaseSocket?.();
    releaseSocket = null;
    publish({
      channelId: null,
      peers: [],
      streams: [],
      joining: false,
      muted: false,
      deafened: false,
      sharing: false,
      status: null,
      error: null,
    });
  }
}

export function toggleVoiceMute() {
  publish({ muted: call.toggleMute() });
}

export function toggleVoiceDeafen() {
  publish({ deafened: !snapshot.deafened });
}

export async function toggleScreenShare() {
  publish({ error: null });
  try {
    if (call.sharing) call.stopShare();
    else await call.startShare();
    publish({ sharing: call.sharing });
  } catch (error) {
    publish({ sharing: call.sharing, error: error instanceof Error ? error.message : "Não foi possível transmitir a aba" });
  }
}
