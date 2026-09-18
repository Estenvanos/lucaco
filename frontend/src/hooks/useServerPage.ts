import { useState } from "react";
import { useNavigate } from "react-router";
import { ROUTES } from "../constants/routes";
import { createChannelSchema } from "../schemas/servers.schema";
import { useChannels, useCreateChannel, useMembers, useServers } from "../services/servers/servers.api";
import type { UserStatus } from "../types/users.types";
import type { ChatPerson } from "../types/ui.types";
import type { PeerInfo, VoiceTile } from "../types/voice.types";
import { useAuth } from "./useAuth";
import { useZodForm } from "./useZodForm";
import {
  DEFAULT_USER_AUDIO,
  joinVoice,
  leaveVoice,
  setUserVolume,
  toggleScreenShare,
  toggleUserMute,
  toggleVoiceDeafen,
  toggleVoiceMute,
  unwatchStream,
  useVoice,
  watchStream,
} from "../services/voice/voice";

/** Online first, then do-not-disturb, offline at the bottom — like the member list reads. */
const STATUS_ORDER: Record<UserStatus, number> = { online: 0, dnd: 1, offline: 2 };

/**
 * One server screen: its channels, members and the text channel on screen. With no channel in
 * the URL the first text channel ("geral", created with the server) is the one shown.
 */
export function useServerPage(serverId: string, channelId: string | undefined) {
  const me = useAuth().user!;
  const navigate = useNavigate();
  const { data: servers = [] } = useServers();
  const { data: channels = [], isPending: channelsLoading } = useChannels(serverId);
  const { data: members = [] } = useMembers(serverId);
  const create = useCreateChannel(serverId);
  const [creating, setCreating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const server = servers.find((s) => s.id === serverId) ?? null;
  const textChannels = channels.filter((c) => c.type === "text");
  const activeChannel = textChannels.find((c) => c.id === channelId) ?? textChannels[0] ?? null;
  const voiceChannel = channels.find((c) => c.type === "voice") ?? null;
  const voice = useVoice(voiceChannel?.id ?? null);
  const inCall = voice.channelId !== null && voice.channelId === voiceChannel?.id;
  const callers = voice.observedChannelId === voiceChannel?.id ? voice.participants : [];
  const personOf = (participant: PeerInfo): ChatPerson => {
    const member = members.find((m) => m.userId === participant.userId);
    return {
      id: participant.userId,
      username: participant.username,
      displayName: member?.nickname ?? member?.displayName ?? null,
      avatarUrl: member?.avatarUrl ?? null,
    };
  };
  const tiles: VoiceTile[] = callers.map((participant) => ({
    socketId: participant.socketId,
    person: personOf(participant),
    speaking: voice.speaking.includes(participant.socketId),
    muted: participant.socketId === voice.socketId && voice.muted,
    audio: voice.userAudio[participant.userId] ?? DEFAULT_USER_AUDIO,
    sharing: participant.sharing,
    viewers: callers.filter((p) => p.viewing === participant.socketId).map(personOf),
  }));

  const createForm = useZodForm(createChannelSchema, async (values) => {
    const channel = await create.mutateAsync(values);
    setCreating(false);
    navigate(ROUTES.channel(serverId, channel.id));
  });

  return {
    server,
    currentUserId: me.id,
    textChannels,
    voiceChannel,
    voice,
    inCall,
    tiles,
    chatOpen,
    toggleChat: () => setChatOpen((open) => !open),
    watchStream,
    unwatchStream,
    audioOutputId: me.settings.audioOutputId,
    joinVoice: () => voiceChannel && joinVoice(voiceChannel.id, me.settings.audioInputId),
    leaveVoice,
    toggleVoiceMute,
    toggleVoiceDeafen,
    toggleScreenShare,
    setUserVolume,
    toggleUserMute,
    activeChannel,
    channelsLoading,
    members: [...members].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    // ponytail: only the owner sees "+"; admins with MANAGE_SERVER still get it from the API.
    // Expose the caller's permissions (GET /servers/:id/permissions) when roles get a UI.
    canManage: server?.ownerId === me.id,
    creating,
    toggleCreating: () => setCreating((open) => !open),
    createForm: { ...createForm, loading: create.isPending },
  };
}
