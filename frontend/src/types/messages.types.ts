import type { UserProfile } from "./users.types";

/** What the API stores and relays: opaque ciphertext. */
export type StoredMessage = {
  id: string;
  channelId: string;
  senderId: string;
  clientMessageId: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
};

export type HistoryResponse = {
  channelId: string;
  messages: StoredMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

/** A message after decryption, in memory only. `text` is null when it could not be decrypted. */
export type ChatMessage = {
  id: string;
  senderId: string;
  text: string | null;
  createdAt: string;
};

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
