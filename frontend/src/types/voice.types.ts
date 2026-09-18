export type PeerInfo = { socketId: string; userId: string; username: string; sharing: boolean };

export type Signal = {
  from: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export type Peer = PeerInfo & {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
};

export type CallEvents = {
  onPeersChange: (peers: PeerInfo[]) => void;
  onStream: (key: string, stream: MediaStream | null, label: string) => void;
  onStatus: (message: string) => void;
};

export type VoiceStream = {
  key: string;
  stream: MediaStream;
  label: string;
  hasVideo: boolean;
};

export type VoiceSnapshot = {
  channelId: string | null;
  observedChannelId: string | null;
  peers: PeerInfo[];
  participants: PeerInfo[];
  streams: VoiceStream[];
  joining: boolean;
  muted: boolean;
  deafened: boolean;
  sharing: boolean;
  status: string | null;
  error: string | null;
};
