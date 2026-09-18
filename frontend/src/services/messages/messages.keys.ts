export const messagesKeys = {
  all: ["messages"] as const,
  conversations: () => [...messagesKeys.all, "conversations"] as const,
  chat: (peerId: string) => [...messagesKeys.all, "chat", peerId] as const,
};
