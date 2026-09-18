import type { UserProfile } from "./users.types";

/** What the API stores and relays: opaque ciphertext. */
export type StoredMessage = {
  id: string;
  channelId: string;
  senderId: string;
  clientMessageId: string;
  contentType: MessageContentType;
  ciphertext: string;
  iv: string;
  /** Channel key epoch it was encrypted with; null for DMs. */
  keyEpoch: number | null;
  createdAt: string;
};

export type MessageContentType = "text" | "audio";

/**
 * What an audio message's ciphertext decrypts to. The file has its own random key, carried here
 * (inside the E2E envelope), so playing it needs nothing from the conversation.
 */
export type AudioRef = { mediaId: string; key: string; iv: string; mime: string; durationMs: number };

export type HistoryResponse = {
  channelId: string;
  messages: StoredMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

/**
 * A message after decryption, in memory only. `text` is null when it could not be decrypted;
 * an audio message has `audio` and no text.
 */
export type ChatMessage = {
  id: string;
  senderId: string;
  text: string | null;
  audio: AudioRef | null;
  createdAt: string;
};

/** A channel key as the API returns it: wrapped for me by `wrapperPublicKey`'s owner. */
export type KeyShare = { epoch: number; encryptedKey: string; iv: string; wrapperPublicKey: string };

export type ChannelKeysResponse = {
  latest: number;
  shares: KeyShare[];
  recipients: { userId: string; publicKey: string; hasShare: boolean }[];
  rotate: boolean;
};

/** The channel keys this browser could open, by epoch, and the one to encrypt with. */
export type Keyring = { keys: Map<number, CryptoKey>; current: number };

/** One page in the chat cache: newest first, like the API. */
export type ChatPage = {
  channelId: string;
  messages: ChatMessage[];
  nextCursor: string | null;
};

/** A message ready to render: `first` starts a new block (avatar + name), `day` a date divider. */
export type ChatRow = ChatMessage & { first: boolean; day: string | null };

export type PublishedKey = { publicKey: string; algorithm: string };

export type Conversation = {
  peer: UserProfile;
  lastMessageAt: string;
};

/** What the composer sends: text, or a voice message already uploaded (its reference). */
export type Outgoing = { text: string; audio: null } | { text: ""; audio: AudioRef };

/** Where a voice message is uploaded: the same conversation the message goes to. */
export type MediaTarget = { peerId: string } | { channelId: string };

export type RecorderState = "idle" | "recording" | "sending";

/** What the composer's microphone button drives. */
export type VoiceRecorder = {
  state: RecorderState;
  elapsedMs: number;
  error: string | null;
  start: () => void;
  /** `send` false discards the recording. */
  stop: (send: boolean) => void;
  /** Ref callback: stops the microphone if the composer unmounts mid-recording. */
  attach: (el: HTMLElement | null) => () => void;
};

export type RecordingSession = {
  recorder: MediaRecorder;
  stream: MediaStream;
  startedAt: number;
  send: boolean;
  timers: ReturnType<typeof setTimeout>[];
};
