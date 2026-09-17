import type { Socket } from "socket.io-client";

export type PeerInfo = { socketId: string; userId: string; username: string; sharing: boolean };
type Signal = { from: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type Peer = PeerInfo & { pc: RTCPeerConnection; polite: boolean; makingOffer: boolean; ignoreOffer: boolean };

// ponytail: STUN only, ~1/5 of users behind strict NAT will fail. Add coturn (TURN) before real users.
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

// ponytail: fixed 720p30 so the mesh (one encode + one upload per peer) does not choke.
// Higher presets and a "smooth" mode (motion hint + maintain-framerate) need the mediasoup SFU first.
const SCREEN = { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 };
// Best screen codecs first (static regions cost far less than in VP8); the browser falls back on its own.
const SCREEN_CODECS = ["video/VP9", "video/H264"];
const STATS_INTERVAL_MS = 5_000;

export type CallEvents = {
  onPeersChange: (peers: PeerInfo[]) => void;
  onStream: (key: string, stream: MediaStream | null, label: string) => void;
  onStatus: (message: string) => void;
};

/**
 * P2P mesh call: one RTCPeerConnection per peer, signaling through Socket.IO.
 * Uses "perfect negotiation" so renegotiation (starting/stopping screen share) works from either side.
 */
export class Call {
  private peers = new Map<string, Peer>();
  private mic: MediaStream | null = null;
  private screen: MediaStream | null = null;
  private statsTimer: number | null = null;

  constructor(
    private socket: Socket,
    private events: CallEvents,
  ) {
    socket.on("voice:peer-joined", (info: PeerInfo) => this.addPeer(info));
    socket.on("voice:peer-left", ({ socketId }: { socketId: string }) => this.removePeer(socketId));
    socket.on("voice:screen", ({ socketId, sharing }: { socketId: string; sharing: boolean }) => {
      const peer = this.peers.get(socketId);
      if (!peer) return;
      peer.sharing = sharing;
      this.emitPeers();
      if (sharing) this.events.onStatus(`${peer.username} começou a compartilhar a aba`);
    });
    socket.on("voice:signal", (signal: Signal) => this.handleSignal(signal).catch(console.error));
  }

  get sharing() {
    return this.screen !== null;
  }

  async join(roomId: string) {
    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    const res = await this.socket.emitWithAck("voice:join", { roomId });
    if (res.error) {
      this.stopMic();
      throw new Error(res.error);
    }
    for (const info of res.peers as PeerInfo[]) this.addPeer(info);
    this.emitPeers();
  }

  async leave() {
    this.stopShare();
    for (const id of [...this.peers.keys()]) this.removePeer(id);
    this.stopMic();
    await this.socket.emitWithAck("voice:leave", {});
  }

  toggleMute() {
    const track = this.mic?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return !track.enabled;
  }

  /** Native OS capture via getDisplayMedia, restricted to a browser tab + that tab's audio. */
  async startShare() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { max: SCREEN.width },
        height: { max: SCREEN.height },
        frameRate: { max: SCREEN.frameRate },
        displaySurface: "browser",
      },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      // Hints (Chromium): offer tabs first, hide whole-monitor option.
      preferCurrentTab: false,
      selfBrowserSurface: "include",
      surfaceSwitching: "include",
      monitorTypeSurfaces: "exclude",
    } as DisplayMediaStreamOptions);

    const video = stream.getVideoTracks()[0];
    const surface = (video.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
    if (surface && surface !== "browser") {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("Compartilhe uma ABA do navegador (janela/tela não são permitidas).");
    }
    if (!stream.getAudioTracks().length) {
      this.events.onStatus("Sem áudio: marque 'compartilhar áudio da aba' para transmitir com som.");
    }

    video.contentHint = "detail";
    video.addEventListener("ended", () => this.stopShare()); // "Stop sharing" button of the browser
    this.screen = stream;
    for (const peer of this.peers.values()) this.addScreenTracks(peer.pc);
    this.events.onStream("local-screen", stream, "Você (aba)");
    this.socket.emit("voice:screen", { sharing: true });
    this.statsTimer = window.setInterval(() => this.logScreenStats(), STATS_INTERVAL_MS);
  }

  /**
   * One line per peer with what actually limits the share: `qualityLimitationReason` is
   * "bandwidth" (raise/lower maxBitrate, or too many peers), "cpu" (encoder too slow) or "none".
   */
  private async logScreenStats() {
    for (const peer of this.peers.values()) {
      const stats = await peer.pc.getStats();
      for (const s of stats.values()) {
        if (s.type !== "outbound-rtp" || s.kind !== "video") continue;
        const codec = stats.get(s.codecId)?.mimeType ?? "?";
        console.log(
          `[screen->${peer.username}] ${s.frameWidth}x${s.frameHeight}@${s.framesPerSecond ?? 0}fps ` +
            `${Math.round((s.targetBitrate ?? 0) / 1000)}kbps ${codec} limit=${s.qualityLimitationReason}`,
        );
      }
    }
  }

  stopShare() {
    if (this.statsTimer !== null) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    if (!this.screen) return;
    const tracks = this.screen.getTracks();
    tracks.forEach((t) => t.stop());
    for (const { pc } of this.peers.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track && tracks.includes(sender.track)) pc.removeTrack(sender);
      }
    }
    this.screen = null;
    this.events.onStream("local-screen", null, "");
    this.socket.emit("voice:screen", { sharing: false });
  }

  private addScreenTracks(pc: RTCPeerConnection) {
    const screen = this.screen;
    if (!screen) return;
    for (const track of screen.getTracks()) {
      const sender = pc.addTrack(track, screen);
      if (track.kind === "video") this.tuneScreenSender(pc, sender);
    }
  }

  /** Caps bitrate/framerate and prefers a screen-friendly codec; without this the browser default (~2.5 Mbps VP8) applies. */
  private tuneScreenSender(pc: RTCPeerConnection, sender: RTCRtpSender) {
    const transceiver = pc.getTransceivers().find((t) => t.sender === sender);
    const codecs = RTCRtpSender.getCapabilities("video")?.codecs ?? [];
    if (transceiver && codecs.length) {
      const rank = (c: RTCRtpCodec) => {
        const i = SCREEN_CODECS.indexOf(c.mimeType);
        return i === -1 ? SCREEN_CODECS.length : i;
      };
      transceiver.setCodecPreferences([...codecs].sort((a, b) => rank(a) - rank(b)));
    }

    const params = sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = SCREEN.maxBitrate;
    params.encodings[0].maxFramerate = SCREEN.frameRate;
    params.degradationPreference = "maintain-resolution"; // sharp text: drop frames, keep 720p
    sender.setParameters(params).catch((err) => console.warn("screen sender params rejected", err));
  }

  private addPeer(info: PeerInfo) {
    if (this.peers.has(info.socketId) || !this.mic) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer: Peer = {
      ...info,
      pc,
      polite: this.socket.id! < info.socketId,
      makingOffer: false,
      ignoreOffer: false,
    };
    this.peers.set(info.socketId, peer);

    const mic = this.mic;
    mic.getTracks().forEach((t) => pc.addTrack(t, mic));
    this.addScreenTracks(pc);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.socket.emit("voice:signal", { to: info.socketId, candidate: candidate.toJSON() });
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        this.socket.emit("voice:signal", { to: info.socketId, description: pc.localDescription });
      } catch (err) {
        console.error(err);
      } finally {
        peer.makingOffer = false;
      }
    };

    // Each remote MediaStream (mic, or tab video + tab audio) becomes one <video> element.
    pc.ontrack = ({ track, streams: [stream] }) => {
      const key = `${info.socketId}:${stream.id}`;
      const label = stream.getVideoTracks().length || track.kind === "video" ? `${info.username} (aba)` : info.username;
      const update = () => this.events.onStream(key, stream.getTracks().length ? stream : null, label);
      stream.onremovetrack = update;
      update();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") this.events.onStatus(`Conexão com ${info.username} falhou (NAT?)`);
    };

    this.emitPeers();
  }

  private removePeer(socketId: string) {
    const peer = this.peers.get(socketId);
    if (!peer) return;
    for (const receiver of peer.pc.getReceivers()) receiver.track.stop();
    peer.pc.close();
    this.peers.delete(socketId);
    this.events.onStream(socketId, null, ""); // prefix: removes every stream of this peer
    this.emitPeers();
  }

  private async handleSignal({ from, description, candidate }: Signal) {
    const peer = this.peers.get(from);
    if (!peer) return;
    const { pc } = peer;

    if (description) {
      const collision = description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
      peer.ignoreOffer = !peer.polite && collision;
      if (peer.ignoreOffer) return;

      await pc.setRemoteDescription(description);
      if (description.type === "offer") {
        await pc.setLocalDescription();
        this.socket.emit("voice:signal", { to: from, description: pc.localDescription });
      }
    } else if (candidate) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (!peer.ignoreOffer) throw err;
      }
    }
  }

  private stopMic() {
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }

  private emitPeers() {
    this.events.onPeersChange([...this.peers.values()].map(({ socketId, userId, username, sharing }) => ({ socketId, userId, username, sharing })));
  }
}
