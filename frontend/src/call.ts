import { Room, RoomEvent, Track, type RemoteParticipant, type RemoteTrack, type RemoteTrackPublication } from "livekit-client";
import type { Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "./constants/socket-events";
import { openProcessedMic } from "./services/audio/processing";
import type { UserSettings } from "./types/users.types";
import type { CallEvents, PeerInfo, ProcessedMic } from "./types/voice.types";

// 1080p30 at ~4 Mbps: with the SFU the streamer uploads this once, whatever the viewer count.
// ponytail: fixed quality; add a picker (720p/1080p, "motion" contentHint) if uploads start to choke.
const SCREEN = { width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_000_000 };

const isScreen = (source: Track.Source) => source === Track.Source.ScreenShare || source === Track.Source.ScreenShareAudio;

/**
 * Voice call over a LiveKit SFU: one connection to the server instead of one per peer.
 * Socket.IO stays the source of truth for who is in the room, who shares and who watches;
 * LiveKit only carries the media. Participant identity = socket id (set in the join token).
 */
export class Call {
  private room: Room | null = null;
  private peers = new Map<string, PeerInfo>();
  private screen: MediaStream | null = null;
  /** Socket id of the stream this tab watches: screen tracks are only subscribed for it. */
  private watching: string | null = null;
  private muted = false;
  /** Noise suppression + EQ graph behind the published mic track. */
  private mic: ProcessedMic | null = null;
  /** One MediaStream per "<socketId>:mic" or "<socketId>:screen" (tab video + tab audio together). */
  private remote = new Map<string, MediaStream>();

  constructor(
    private socket: Socket,
    private events: CallEvents,
  ) {
    socket.on(SOCKET_EVENTS.voicePeerJoined, (info: PeerInfo) => {
      this.peers.set(info.socketId, info);
      this.emitPeers();
    });
    socket.on(SOCKET_EVENTS.voicePeerLeft, ({ socketId }: { socketId: string }) => this.removePeer(socketId));
    socket.on(SOCKET_EVENTS.voiceScreen, ({ socketId, sharing }: { socketId: string; sharing: boolean }) => {
      const peer = this.peers.get(socketId);
      if (!peer) return;
      peer.sharing = sharing;
      if (!sharing && this.watching === socketId) this.watching = null;
      this.emitPeers();
      if (sharing) this.events.onStatus(`${peer.username} começou a compartilhar a aba`);
    });
  }

  get sharing() {
    return this.screen !== null;
  }

  /** Whether the channel lets this user talk (SPEAK). */
  canSpeak = true;

  get micStream() {
    const track = this.room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
    return track ? new MediaStream([track.mediaStreamTrack]) : null;
  }

  async join(channelId: string, settings: UserSettings) {
    const res = await this.socket.emitWithAck(SOCKET_EVENTS.voiceJoin, { channelId });
    if (res.error) throw new Error(res.error);
    this.canSpeak = res.canSpeak !== false;
    this.muted = false;
    for (const info of res.peers as PeerInfo[]) this.peers.set(info.socketId, info);

    // ponytail: no adaptiveStream — it pauses video that has no element attached through
    // track.attach(), and VoiceStage plays the MediaStreams itself.
    const room = new Room({ dynacast: true });
    this.bind(room);
    this.room = room;
    try {
      await room.connect(res.livekit.url, res.livekit.token, { autoSubscribe: false });
      // Without SPEAK the token cannot publish audio: the mic is never opened.
      // ponytail: EQ/noise settings apply on the next join — rebuild the graph live if asked.
      if (this.canSpeak) {
        this.mic = await openProcessedMic(settings);
        await room.localParticipant.publishTrack(this.mic.track, { source: Track.Source.Microphone });
      }
    } catch (err) {
      await this.leave();
      throw err;
    }
    for (const participant of room.remoteParticipants.values()) this.syncParticipant(participant);
    this.emitPeers();
  }

  async leave() {
    this.stopShare();
    const room = this.room;
    this.room = null; // before disconnect(), so the Disconnected handler stays quiet
    for (const id of [...this.peers.keys()]) this.removePeer(id);
    this.remote.clear();
    this.watching = null;
    await room?.disconnect();
    this.mic?.close();
    this.mic = null;
    await this.socket.emitWithAck(SOCKET_EVENTS.voiceLeave, {});
  }

  toggleMute() {
    if (!this.canSpeak) return true;
    const mic = this.room?.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (!mic) return false;
    this.muted = !this.muted;
    void (this.muted ? mic.mute() : mic.unmute());
    return this.muted;
  }

  /** Native OS capture via getDisplayMedia: a browser tab (+ tab audio) or a whole monitor (+ system audio, Windows/ChromeOS). */
  async startShare() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { max: SCREEN.width },
        height: { max: SCREEN.height },
        frameRate: { max: SCREEN.frameRate },
        displaySurface: "browser",
      },
      // restrictOwnAudio: keep this page's call audio out of system-audio capture (no echo for viewers); ignored where unsupported.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, restrictOwnAudio: true },
      // Hints (Chromium): offer tabs first, also allow whole monitor (no blue tab border).
      preferCurrentTab: false,
      selfBrowserSurface: "include",
      surfaceSwitching: "include",
      monitorTypeSurfaces: "include",
      systemAudio: "include",
    } as DisplayMediaStreamOptions);

    const video = stream.getVideoTracks()[0];
    const surface = (video.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
    if (surface && surface !== "browser" && surface !== "monitor") {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("Compartilhe uma ABA ou a TELA inteira (janela não é permitida).");
    }
    const audio = stream.getAudioTracks()[0];
    if (!audio) {
      this.events.onStatus("Sem áudio: marque 'compartilhar áudio' no seletor (tela inteira só tem áudio no Windows/ChromeOS).");
    }

    video.contentHint = "detail";
    video.addEventListener("ended", () => this.stopShare()); // "Stop sharing" button of the browser
    this.screen = stream;
    this.events.onStream("local-screen", stream, surface === "monitor" ? "Você (tela)" : "Você (aba)");
    try {
      const response = await this.socket.emitWithAck(SOCKET_EVENTS.voiceScreen, { sharing: true });
      if (response.error) throw new Error(response.error);
      const local = this.room?.localParticipant;
      if (!local) throw new Error("Entre no canal de voz antes de transmitir");
      // The SFU replicates this one upload to every viewer; the token must grant STREAM.
      await local.publishTrack(video, {
        source: Track.Source.ScreenShare,
        // VP9 compresses screen content far better than VP8 and is published as SVC (L3T3_KEY by
        // default): one encode carrying 1080p/540p/270p layers, so the SFU sends each viewer the layer
        // their connection holds. LiveKit adds a simulcast VP8 backup for browsers that cannot decode VP9.
        videoCodec: "vp9",
        screenShareEncoding: { maxBitrate: SCREEN.maxBitrate, maxFramerate: SCREEN.frameRate },
        degradationPreference: "maintain-resolution", // sharp text: drop frames, keep the resolution
      });
      if (audio) await local.publishTrack(audio, { source: Track.Source.ScreenShareAudio });
    } catch (err) {
      this.stopShare();
      throw err;
    }
  }

  stopShare() {
    const screen = this.screen;
    if (!screen) return;
    this.screen = null;
    for (const track of screen.getTracks()) {
      void this.room?.localParticipant.unpublishTrack(track).catch(() => {}); // never published if startShare failed
      track.stop();
    }
    this.events.onStream("local-screen", null, "");
    this.socket.emit(SOCKET_EVENTS.voiceScreen, { sharing: false });
  }

  async watchStream(socketId: string) {
    const res = await this.socket.emitWithAck(SOCKET_EVENTS.voiceStreamWatch, { socketId });
    if (res.error) throw new Error(res.error);
    this.setWatching(socketId);
  }

  unwatchStream() {
    this.socket.emit(SOCKET_EVENTS.voiceStreamUnwatch, {});
    this.setWatching(null);
  }

  private bind(room: Room) {
    room
      .on(RoomEvent.TrackPublished, (publication, participant) => this.syncTrack(publication, participant))
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => this.addTrack(track, publication, participant))
      .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => this.dropTrack(track, publication, participant))
      .on(RoomEvent.Reconnecting, () => this.events.onStatus("Reconectando ao servidor de mídia..."))
      .on(RoomEvent.Reconnected, () => this.events.onStatus("Conectado ao canal de voz"))
      .on(RoomEvent.Disconnected, () => {
        if (this.room === room) this.events.onStatus("Desconectado do servidor de mídia");
      });
  }

  /** Microphones are always heard; a screen is only received while its owner is being watched. */
  private syncTrack(publication: RemoteTrackPublication, participant: RemoteParticipant) {
    const wanted =
      publication.source === Track.Source.Microphone || (isScreen(publication.source) && this.watching === participant.identity);
    if (wanted !== publication.isDesired) publication.setSubscribed(wanted);
  }

  private syncParticipant(participant: RemoteParticipant) {
    for (const publication of participant.trackPublications.values()) this.syncTrack(publication, participant);
  }

  private setWatching(socketId: string | null) {
    const previous = this.watching;
    this.watching = socketId;
    for (const id of [previous, socketId]) {
      const participant = id ? this.room?.remoteParticipants.get(id) : undefined;
      if (participant) this.syncParticipant(participant);
    }
  }

  private streamOf(publication: RemoteTrackPublication, participant: RemoteParticipant) {
    const screen = isScreen(publication.source);
    const name = this.peers.get(participant.identity)?.username ?? participant.name ?? participant.identity;
    return { key: `${participant.identity}:${screen ? "screen" : "mic"}`, label: screen ? `${name} (aba)` : name };
  }

  private addTrack(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
    const { key, label } = this.streamOf(publication, participant);
    const stream = this.remote.get(key) ?? new MediaStream();
    this.remote.set(key, stream);
    stream.addTrack(track.mediaStreamTrack);
    this.events.onStream(key, stream, label);
  }

  private dropTrack(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) {
    const { key, label } = this.streamOf(publication, participant);
    const stream = this.remote.get(key);
    if (!stream) return;
    stream.removeTrack(track.mediaStreamTrack);
    if (stream.getTracks().length) return this.events.onStream(key, stream, label);
    this.remote.delete(key);
    this.events.onStream(key, null, "");
  }

  private removePeer(socketId: string) {
    if (!this.peers.delete(socketId)) return;
    for (const key of [...this.remote.keys()]) if (key.startsWith(`${socketId}:`)) this.remote.delete(key);
    if (this.watching === socketId) this.watching = null;
    this.events.onStream(socketId, null, ""); // prefix: removes every stream of this peer
    this.emitPeers();
  }

  private emitPeers() {
    this.events.onPeersChange([...this.peers.values()].map(({ socketId, userId, username, sharing, viewing }) => ({ socketId, userId, username, sharing, viewing })));
  }
}
