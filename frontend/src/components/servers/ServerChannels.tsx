import { Mic, MicOff, Phone, Settings, ScreenShare, ScreenShareOff, Volume2, VolumeX } from "lucide-react";
import { NavLink } from "react-router";
import { ROUTES } from "../../constants/routes";
import { formatDate } from "../../lib/utils";
import type { ServerChannelsProps } from "../../types/ui.types";
import { ChatAvatar } from "../chat/ChatAvatar";
import { DEFAULT_USER_AUDIO } from "../../services/voice/voice";
import { ServerAvatar } from "./ServerAvatar";
import { openContextMenu } from "../../lib/context-menu";
import { VoiceUserMenu } from "./VoiceUserMenu";

export function ServerChannels({
  server,
  currentUserId,
  voiceChannel,
  members,
  textChannels,
  activeChannelId,
  canManage,
  onCreateChannel,
  onEditChannel,
  voice,
  onJoinVoice,
  onLeaveVoice,
  onMuteVoice,
  onDeafenVoice,
  onShareVoice,
  onUserVolume,
  onUserMute,
}: ServerChannelsProps) {
  const editable = (channel: { permissions: string[] }) =>
    channel.permissions.includes("MANAGE_CHANNELS") || channel.permissions.includes("MANAGE_ROLES");
  const joinedHere = voice.channelId === voiceChannel?.id;
  const participantsByUser = new Map<string, (typeof voice.participants)[number]>();
  if (voice.observedChannelId === voiceChannel?.id) {
    for (const participant of voice.participants) {
      const previous = participantsByUser.get(participant.userId);
      participantsByUser.set(participant.userId, {
        ...participant,
        sharing: participant.sharing || Boolean(previous?.sharing),
      });
    }
  }
  const participants = [...participantsByUser.values()];
  const currentMember = members.find((member) => member.userId === currentUserId);
  const currentParticipant = participantsByUser.get(currentUserId);
  const currentIdentity = {
    id: currentUserId,
    username: currentMember?.username ?? currentParticipant?.username ?? "Você",
    displayName: currentMember?.displayName ?? null,
    avatarUrl: currentMember?.avatarUrl ?? null,
  };

  return (
    <aside className="server-channels">
      <header className="server-info">
        <span className="server-info-icon">
          <ServerAvatar server={server} />
        </span>
        <div>
          <h1>{server.name}</h1>
          <p>Criado {formatDate(server.createdAt)}</p>
        </div>
      </header>

      {voiceChannel && (
        <section className="server-voice" aria-label="Canal de voz">
          {joinedHere ? (
            <div className="server-voice-connected">
              <strong>Em chamada</strong>
              <button type="button" aria-label="Desconectar" title="Desconectar" onClick={onLeaveVoice}>
                <Phone className="voice-hangup-icon" aria-hidden />
              </button>
            </div>
          ) : (
            <div className="server-voice-bar">
              <span>{voiceChannel.name}</span>
              {editable(voiceChannel) && (
                <button
                  type="button"
                  className="server-channel-gear"
                  title="Editar canal"
                  onClick={() => onEditChannel(voiceChannel)}
                >
                  <Settings aria-hidden />
                  <span className="sr-only">Editar canal</span>
                </button>
              )}
              <button
                type="button"
                disabled={voice.joining || !voiceChannel.permissions.includes("CONNECT")}
                title={voiceChannel.permissions.includes("CONNECT") ? undefined : "Sem permissão para conectar"}
                onClick={onJoinVoice}
              >
                {voice.joining ? "Entrando..." : "Entrar"}
              </button>
            </div>
          )}
          {participants.length ? (
            <ul className="server-voice-members">
              {participants.map((participant) => {
                const member = members.find((item) => item.userId === participant.userId);
                const audio = voice.userAudio[participant.userId] ?? DEFAULT_USER_AUDIO;
                // Only while in the call, and never on yourself: there is nothing to play otherwise.
                const hasMenu = joinedHere && participant.userId !== currentUserId;
                return (
                  <li
                    key={participant.userId}
                    tabIndex={hasMenu ? 0 : undefined}
                    onContextMenu={hasMenu ? openContextMenu : undefined}
                  >
                    <ChatAvatar user={{
                      id: participant.userId,
                      username: participant.username,
                      displayName: member?.displayName ?? null,
                      avatarUrl: member?.avatarUrl ?? null,
                    }} />
                    <span>
                      <strong>{participant.username}</strong>
                    </span>
                    {participant.sharing && (
                      <span className="server-voice-live" role="img" aria-label="Transmitindo" title="Transmitindo">
                        <ScreenShare aria-hidden />
                      </span>
                    )}
                    {audio.muted && <VolumeX className="server-voice-silenced" aria-label="Silenciado para você" />}
                    {hasMenu && (
                      <VoiceUserMenu
                        name={member?.displayName ?? participant.username}
                        audio={audio}
                        onVolume={(volume) => onUserVolume(participant.userId, volume)}
                        onMute={() => onUserMute(participant.userId)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="server-voice-empty">Ninguém na chamada</p>
          )}
          {voice.error && <p className="server-voice-error" role="alert">{voice.error}</p>}
        </section>
      )}

      <section className="server-text">
        <div className="server-text-head">
          <h2>Chat de texto</h2>
          {canManage && (
            <button
              type="button"
              className="server-text-add"
              title="Criar canal de texto"
              onClick={onCreateChannel}
            >
              +<span className="sr-only">Criar canal de texto</span>
            </button>
          )}
        </div>

        <nav>
          {textChannels.map((channel) => (
            <div key={channel.id} className="server-text-item">
              <NavLink
                to={ROUTES.channel(server.id, channel.id)}
                className="server-text-link"
                aria-current={channel.id === activeChannelId ? "page" : undefined}
              >
                <span aria-hidden>#</span>
                {channel.name}
              </NavLink>
              {editable(channel) && (
                <button
                  type="button"
                  className="server-channel-gear"
                  title={`Editar #${channel.name}`}
                  onClick={() => onEditChannel(channel)}
                >
                  <Settings aria-hidden />
                  <span className="sr-only">Editar #{channel.name}</span>
                </button>
              )}
            </div>
          ))}
        </nav>
      </section>

      {joinedHere && (
        <div className="voice-dock">
          <div className="voice-dock-user">
            <ChatAvatar user={currentIdentity} />
            <span>
              <strong>{currentIdentity.username}</strong>
              <small>Em chamada</small>
            </span>
          </div>
          <div className="voice-dock-controls">
            <button
              type="button"
              aria-label={voice.deafened ? "Ativar áudio" : "Silenciar áudio"}
              aria-pressed={voice.deafened}
              title={voice.deafened ? "Ativar áudio" : "Silenciar áudio"}
              onClick={onDeafenVoice}
            >
              {voice.deafened ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
            </button>
            <button
              type="button"
              aria-label={voice.muted ? "Ativar microfone" : "Mutar microfone"}
              aria-pressed={voice.muted}
              title={voice.muted ? "Ativar microfone" : "Mutar microfone"}
              onClick={onMuteVoice}
            >
              {voice.muted ? <MicOff aria-hidden /> : <Mic aria-hidden />}
            </button>
            <button
              type="button"
              aria-label={voice.sharing ? "Parar transmissão" : "Transmitir aba"}
              aria-pressed={voice.sharing}
              title={voice.sharing ? "Parar transmissão" : "Transmitir aba"}
              onClick={onShareVoice}
            >
              {voice.sharing ? <ScreenShareOff aria-hidden /> : <ScreenShare aria-hidden />}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
