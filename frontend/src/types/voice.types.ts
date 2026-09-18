import type { ChatPerson } from "./ui.types";

/** `viewing`: socket id of the stream this peer is watching, or null. */
export type PeerInfo = { socketId: string; userId: string; username: string; sharing: boolean; viewing: string | null };

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
  /** This tab's socket in the call: marks the local tile. */
  socketId: string | null;
  observedChannelId: string | null;
  peers: PeerInfo[];
  participants: PeerInfo[];
  streams: VoiceStream[];
  joining: boolean;
  muted: boolean;
  deafened: boolean;
  sharing: boolean;
  /** Socket id of the stream on screen: one at a time, never while sharing. */
  watching: string | null;
  /** First frame of this tab's own share, as a data URL: a still preview, no live video. */
  preview: string | null;
  /** Socket ids whose microphone is above the speaking threshold right now. */
  speaking: string[];
  status: string | null;
  error: string | null;
  /** Local-only mute and volume per remote user id; nobody else hears the change. */
  userAudio: Record<string, UserAudio>;
};

/** Volume is the <audio> element's: 0 to 1. */
export type UserAudio = { muted: boolean; volume: number };

export type VoiceTile = {
  socketId: string;
  person: ChatPerson;
  speaking: boolean;
  /** Only known for the local user: remote mute is not signaled. */
  muted: boolean;
  audio: UserAudio;
  sharing: boolean;
  /** Who is watching this tile's stream. */
  viewers: ChatPerson[];
};
