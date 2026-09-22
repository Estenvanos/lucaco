export const messagesKeys = {
  all: ["messages"] as const,
  conversations: () => [...messagesKeys.all, "conversations"] as const,
  chat: (peerId: string) => [...messagesKeys.all, "chat", peerId] as const,
  channel: (channelId: string) => [...messagesKeys.all, "channel", channelId] as const,
  audio: (mediaId: string) => [...messagesKeys.all, "audio", mediaId] as const,
  attachment: (mediaId: string) => [...messagesKeys.all, "attachment", mediaId] as const,
};
