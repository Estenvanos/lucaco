import { useSyncExternalStore } from "react";
import { Call } from "../../call";
import { SOCKET_EVENTS } from "../../constants/socket-events";
import { holdSocket, socket } from "../../lib/socket";
import type { UserSettings } from "../../types/users.types";
import type { PeerInfo, UserAudio, VoiceSnapshot, VoiceStream } from "../../types/voice.types";

let snapshot: VoiceSnapshot = {
  channelId: null,
  socketId: null,
  observedChannelId: null,
  peers: [],
  participants: [],
  streams: [],
  joining: false,
  muted: false,
  canSpeak: true,
  deafened: false,
  sharing: false,
  watching: null,
  preview: null,
  speaking: [],
  status: null,
  error: null,
  userAudio: {},
  streamVolume: 1,
};
const listeners = new Set<() => void>();
let releaseSocket: (() => void) | null = null;

function publish(change: Partial<VoiceSnapshot>) {
  snapshot = { ...snapshot, ...change };
  for (const listener of listeners) listener();
}

// Speaking indicator: one AnalyserNode per microphone stream, sampled on a timer.
// ponytail: fixed RMS threshold, no hysteresis — add a per-user sensitivity setting if it flickers.
const SPEAKING_RMS = 0.02;
const SPEAKING_POLL_MS = 150;
let audio: AudioContext | null = null;
let meterTimer: number | null = null;
const samples = new Float32Array(512);
const meters = new Map<string, { stream: MediaStream; source: MediaStreamAudioSourceNode; analyser: AnalyserNode }>();

/** Stream keys are "local-mic" or "<socketId>:<streamId>"; the tile is per socket. */
const speakerOf = (key: string) => (key === "local-mic" ? socket.id ?? key : key.split(":")[0]);

function meter(key: string, stream: MediaStream | null) {
  // Tab share streams carry audio too: only video-less streams are microphones. Checked on every
  // call because a share's audio track can arrive before its video track.
  const mic = stream?.getAudioTracks().length && !stream.getVideoTracks().length ? stream : null;
  const current = meters.get(key);
  if (current?.stream === mic) return;
  current?.source.disconnect();
  meters.delete(key);
  if (!audio || !mic) return;
  const source = audio.createMediaStreamSource(mic);
  const analyser = audio.createAnalyser();
  analyser.fftSize = samples.length;
  source.connect(analyser);
  meters.set(key, { stream: mic, source, analyser });
}

function sampleSpeaking() {
  const speaking: string[] = [];
  for (const [key, { analyser }] of meters) {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    if (Math.sqrt(sum / samples.length) > SPEAKING_RMS) speaking.push(speakerOf(key));
  }
  if (speaking.join() !== snapshot.speaking.join()) publish({ speaking });
}

function stopMeters() {
  for (const { source } of meters.values()) source.disconnect();
  meters.clear();
  if (meterTimer !== null) window.clearInterval(meterTimer);
  meterTimer = null;
}

// Playback above 100%: <audio>.volume stops at 1, so remote audio plays through a GainNode.
const playbacks = new Map<string, { stream: MediaStream; holder: HTMLAudioElement; source: AudioNode; gain: GainNode; output: MediaStream }>();

/** The stream to put in the <audio> element for `key`, `volume` times louder (0..2). */
export function playbackOf(key: string, stream: MediaStream, volume: number) {
  if (!audio || !stream.getAudioTracks().length) return stream;
  let playback = playbacks.get(key);
  if (playback?.stream !== stream) {
    dropPlayback(key);
    // Chromium only feeds a remote WebRTC stream to Web Audio while a media element plays it.
    const holder = new Audio();
    holder.muted = true;
    holder.srcObject = stream;
    void holder.play().catch(() => {});
    const source = audio.createMediaStreamSource(stream);
    const gain = audio.createGain();
    const destination = audio.createMediaStreamDestination();
    source.connect(gain).connect(destination);
    playback = { stream, holder, source, gain, output: destination.stream };
    playbacks.set(key, playback);
  }
  playback.gain.gain.value = volume;
  return playback.output;
}

function dropPlayback(key: string) {
  const playback = playbacks.get(key);
  if (!playback) return;
  playback.source.disconnect();
  playback.holder.srcObject = null;
  playbacks.delete(key);
}

const PREVIEW_WIDTH = 480;

/** Still of the share's first frame: the sharer sees what goes out without a second live video. */
async function firstFrame(stream: MediaStream) {
  const video = document.createElement("video");
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_WIDTH;
  canvas.height = Math.round((PREVIEW_WIDTH * video.videoHeight) / (video.videoWidth || 1));
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  video.srcObject = null;
  return canvas.toDataURL("image/jpeg", 0.7);
}

const call = new Call(socket, {
  onPeersChange: (peers: PeerInfo[]) => {
    // The stream on screen ended (or its peer left): back to the tiles.
    const live = peers.some((peer) => peer.socketId === snapshot.watching && peer.sharing);
    publish({ peers, ...(snapshot.watching && !live && { watching: null }) });
  },
  onStream: (key, stream, label) => {
    const streams = stream
      ? [
          ...snapshot.streams.filter((item) => item.key !== key),
          { key, stream, label, hasVideo: stream.getVideoTracks().length > 0 } satisfies VoiceStream,
        ]
      : snapshot.streams.filter((item) => !item.key.startsWith(key));
    if (stream) meter(key, stream);
    else {
      for (const meterKey of [...meters.keys()]) if (meterKey.startsWith(key)) meter(meterKey, null);
      for (const playKey of [...playbacks.keys()]) if (playKey.startsWith(key)) dropPlayback(playKey);
    }
    publish({ streams, ...(key === "local-screen" && { sharing: Boolean(stream), preview: null }) });
    if (key === "local-screen" && stream) {
      void firstFrame(stream)
        .then((preview) => snapshot.sharing && publish({ preview }))
        .catch(() => {});
    }
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

export async function joinVoice(channelId: string, settings: UserSettings) {
  if (snapshot.channelId === channelId || snapshot.joining) return;
  publish({ joining: true, error: null, status: "Conectando ao canal de voz..." });
  try {
    if (snapshot.channelId) await leaveVoice();
    releaseSocket ??= holdSocket();
    // Created on the click that joins: browsers only start an AudioContext after a user gesture.
    audio ??= new AudioContext();
    void audio.resume();
    await call.join(channelId, settings);
    meter("local-mic", call.micStream);
    meterTimer ??= window.setInterval(sampleSpeaking, SPEAKING_POLL_MS);
    publish({
      channelId,
      socketId: socket.id ?? null,
      joining: false,
      muted: !call.canSpeak,
      canSpeak: call.canSpeak,
      status: call.canSpeak ? "Conectado ao canal de voz" : "Conectado — sem permissão para falar",
    });
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
    stopMeters();
    for (const key of [...playbacks.keys()]) dropPlayback(key);
    releaseSocket?.();
    releaseSocket = null;
    publish({
      channelId: null,
      socketId: null,
      speaking: [],
      peers: [],
      streams: [],
      joining: false,
      muted: false,
      deafened: false,
      sharing: false,
      watching: null,
      preview: null,
      status: null,
      error: null,
    });
  }
}

/** Watching stops this tab's own share first: a sharer never watches. */
export async function watchStream(socketId: string) {
  if (snapshot.watching === socketId) return;
  if (call.sharing) call.stopShare();
  publish({ watching: socketId, error: null });
  try {
    await call.watchStream(socketId);
  } catch (error) {
    publish({ watching: null, error: error instanceof Error ? error.message : "Não foi possível abrir a transmissão" });
  }
}

export function unwatchStream() {
  if (!snapshot.watching) return;
  call.unwatchStream();
  publish({ watching: null });
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
    else {
      unwatchStream(); // sharing and watching are exclusive
      await call.startShare();
    }
    publish({ sharing: call.sharing });
  } catch (error) {
    publish({ sharing: call.sharing, error: error instanceof Error ? error.message : "Não foi possível transmitir a aba" });
  }
}

export const DEFAULT_USER_AUDIO: UserAudio = { muted: false, volume: 1 };

// ponytail: kept in memory for the tab's lifetime, not across reloads — persist in user settings if asked.
function setUserAudio(userId: string, change: Partial<UserAudio>) {
  const current = snapshot.userAudio[userId] ?? DEFAULT_USER_AUDIO;
  publish({ userAudio: { ...snapshot.userAudio, [userId]: { ...current, ...change } } });
}

export const setStreamVolume = (streamVolume: number) => publish({ streamVolume });

export const setUserVolume = (userId: string, volume: number) => setUserAudio(userId, { volume });

export const toggleUserMute = (userId: string) =>
  setUserAudio(userId, { muted: !(snapshot.userAudio[userId] ?? DEFAULT_USER_AUDIO).muted });
