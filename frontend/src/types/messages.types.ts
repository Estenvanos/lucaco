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

export type MessageContentType = "text" | "audio" | AttachmentKind;

/**
 * What an audio message's ciphertext decrypts to. The file has its own random key, carried here
 * (inside the E2E envelope), so playing it needs nothing from the conversation.
 */
export type AudioRef = { mediaId: string; key: string; iv: string; mime: string; durationMs: number };

export type AttachmentKind = "image" | "file" | "video";

/**
 * What an image, document or video message's ciphertext decrypts to. A document or video is
 * encrypted with a key of its own, carried here (`key` + `iv`). An image has neither: the API
 * converts it to webp, so it is stored in the clear.
 */
export type AttachmentRef = {
  kind: AttachmentKind;
  mediaId: string;
  mime: string;
  name: string;
  size: number;
  key?: string;
  iv?: string;
  /** Image only: the preview's size, so the lazy <img> holds its place before it loads. */
  width?: number;
  height?: number;
  /** Video only: its first frame as a tiny data URL, so the card shows something before playing. */
  thumb?: string;
};

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
  attachment: AttachmentRef | null;
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

/** The private key encrypted under the recovery password, all base64. Opaque to the API. */
export type KeyBackup = { encryptedPrivateKey: string; salt: string; iv: string };

export type OwnKey = PublishedKey & { backup: KeyBackup | null };

/**
 * restore: unlock the backup of the published key. create: back up a brand new key.
 * upgrade: this browser's key cannot be read out, so backing up means replacing it.
 */
export type KeyPromptKind = "restore" | "create" | "upgrade";

/** The recovery-password dialog currently asked for by the E2E layer. */
export type KeyPrompt = {
  kind: KeyPromptKind;
  /** Throws (dialog stays open) on a wrong password or a failed request. */
  submit: (password: string) => Promise<void>;
  /** The explicit "not now" / "forgot it" button. */
  skip: () => void;
  /** Esc or the close button: ask again next time. */
  dismiss: () => void;
};

/** `GET /messages/conversations`: the last message still encrypted. */
export type ConversationResponse = {
  peer: UserProfile;
  lastMessageAt: string;
  lastMessage: StoredMessage;
};

/** A conversation with its last message decrypted; null when the chat key is not available. */
export type Conversation = {
  peer: UserProfile;
  lastMessageAt: string;
  lastMessage: ChatMessage | null;
};

/** What the composer sends: text, or a voice message / file already uploaded (its reference). */
export type Outgoing =
  | { text: string; audio: null; attachment: null }
  | { text: ""; audio: AudioRef; attachment: null }
  | { text: ""; audio: null; attachment: AttachmentRef };

/** Where a voice message or file is uploaded: the same conversation the message goes to. */
export type MediaTarget = { peerId: string } | { channelId: string };

/** A file picked (or pasted) and waiting in the composer, with a local preview. */
export type PendingFile = { file: File; kind: AttachmentKind; url: string; thumb: string | null };

/** The paperclip: a picked file waits in the composer (preview) until the user sends or removes it. */
export type Attacher = {
  pending: PendingFile | null;
  sending: boolean;
  error: string | null;
  pick: (file: File) => void;
  clear: () => void;
  send: () => void;
};

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
