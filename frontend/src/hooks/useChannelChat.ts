import { ApiError } from "../lib/api";
import { extractMentions } from "../lib/mentions";
import { chatRows, confirmDelete } from "../lib/utils";
import { deleteMessage, sendChannelMessage, useChannelChat as useChannelHistory } from "../services/messages/messages.api";
import { messagesKeys } from "../services/messages/messages.keys";
import { uploadAttachment, uploadVoice } from "../services/messages/messages.media";
import { useChannelLive } from "../services/messages/messages.socket";
import { useMembers } from "../services/servers/servers.api";
import type { Channel } from "../types/servers.types";
import type { ChatRow } from "../types/messages.types";
import type { ChatPerson } from "../types/ui.types";
import { useAttacher } from "./useAttacher";
import { useAuth } from "./useAuth";
import { useComposer } from "./useComposer";
import { useVoiceRecorder } from "./useVoiceRecorder";

/** A server text channel: E2E history (sender keys), live updates and the composer. */
export function useChannelChat(channel: Channel) {
  const me = useAuth().user!;
  const { data: members = [] } = useMembers(channel.serverId);
  const chat = useChannelHistory(me.id, channel.id);
  useChannelLive(me.id, channel.id);
  const people = members.map((m) => ({ userId: m.userId, name: m.nickname ?? m.displayName ?? m.username }));
  const composer = useComposer((out) =>
    sendChannelMessage(me.id, channel.id, out, extractMentions(out.text, people)),
  );
  const voice = useVoiceRecorder(me.settings.audioInputId, async (recording, durationMs) => {
    const audio = await uploadVoice({ channelId: channel.id }, recording, durationMs);
    await sendChannelMessage(me.id, channel.id, { text: "", audio, attachment: null });
  });
  const attacher = useAttacher(async (file, thumb) => {
    const attachment = await uploadAttachment({ channelId: channel.id }, file, thumb);
    await sendChannelMessage(me.id, channel.id, { text: "", audio: null, attachment });
  });

  const messages = chat.data?.pages.flatMap((page) => page.messages) ?? [];
  const canSend = channel.permissions.includes("SEND_MESSAGES");
  const canSendVoice = canSend && channel.permissions.includes("SEND_VOICE_MESSAGES");
  const canAttach = canSend && channel.permissions.includes("ATTACH_FILES");
  const canModerate = channel.permissions.includes("MANAGE_MESSAGES");

  const authorOf = (senderId: string): ChatPerson => {
    if (senderId === me.id) return me;
    const member = members.find((m) => m.userId === senderId);
    return member
      ? { id: member.userId, username: member.username, displayName: member.nickname ?? member.displayName, avatarUrl: member.avatarUrl }
      : { id: senderId, username: "ex-membro", displayName: null, avatarUrl: null };
  };

  return {
    rows: chatRows(messages),
    mentionNames: people.map((p) => p.name),
    myName: people.find((p) => p.userId === me.id)?.name ?? me.username,
    authorOf,
    intro: {
      title: `Bem-vindo a #${channel.name}`,
      text: "Este é o começo do canal. As mensagens são cifradas: só quem pode ver o canal consegue ler.",
    },
    loading: chat.isPending,
    loadError: chat.error instanceof ApiError ? chat.error.message : chat.error ? "Não foi possível abrir o canal" : null,
    hasOlder: chat.hasNextPage,
    loadingOlder: chat.isFetchingNextPage,
    loadOlder: () => chat.fetchNextPage(),
    /** The author, or a member with MANAGE_MESSAGES. */
    canDelete: (row: ChatRow) => row.senderId === me.id || canModerate,
    onDelete: (row: ChatRow) => confirmDelete(() => deleteMessage(messagesKeys.channel(channel.id), row.id)),
    composer: {
      ...composer,
      placeholder: `Conversar em #${channel.name}`,
      label: `Mensagem em #${channel.name}`,
      blocked: canSend ? null : "Você não tem permissão para enviar mensagens neste canal.",
      voice: canSendVoice ? voice : null,
      attacher: canAttach ? attacher : null,
      mentionNames: people.map((p) => p.name),
    },
  };
}
