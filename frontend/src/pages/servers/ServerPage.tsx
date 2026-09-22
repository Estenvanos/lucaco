import { Navigate, useParams } from "react-router";
import { ROUTES } from "../../constants/routes";
import { ChannelSettings } from "../../components/servers/ChannelSettings";
import { ChannelView } from "../../components/servers/ChannelView";
import { MemberList } from "../../components/servers/MemberList";
import { ServerChannels } from "../../components/servers/ServerChannels";
import { VoiceStage } from "../../components/servers/VoiceStage";
import { useServerPage } from "../../hooks/useServerPage";

export function ServerPage() {
  const { serverId = "", channelId } = useParams();
  const page = useServerPage(serverId, channelId);

  if (!page.server) return page.gone ? <Navigate to={ROUTES.friends} replace /> : null;

  return (
    <div className="server" data-call={page.inCall || undefined}>
      <ServerChannels
        server={page.server}
        currentUserId={page.currentUserId}
        voiceChannel={page.voiceChannel}
        members={page.members}
        textChannels={page.textChannels}
        activeChannelId={page.activeChannel?.id ?? null}
        canManage={page.canManage}
        onCreateChannel={page.openCreateChannel}
        onEditChannel={page.openChannelSettings}
        voice={page.voice}
        onJoinVoice={page.joinVoice}
        onLeaveVoice={page.leaveVoice}
        onMuteVoice={page.toggleVoiceMute}
        onDeafenVoice={page.toggleVoiceDeafen}
        onShareVoice={page.toggleScreenShare}
        onUserVolume={page.setUserVolume}
        onUserMute={page.toggleUserMute}
      />
      {page.inCall ? (
        <VoiceStage
          voice={page.voice}
          outputId={page.audioOutputId}
          channelName={page.voiceChannel?.name ?? "Voz"}
          tiles={page.tiles}
          chatChannel={page.textChannels[0] ?? null}
          chatOpen={page.chatOpen}
          onToggleChat={page.toggleChat}
          onMute={page.toggleVoiceMute}
          onDeafen={page.toggleVoiceDeafen}
          onShare={page.toggleScreenShare}
          onLeave={page.leaveVoice}
          onUserVolume={page.setUserVolume}
          onUserMute={page.toggleUserMute}
          onWatch={page.watchStream}
          onUnwatch={page.unwatchStream}
        />
      ) : page.activeChannel ? (
        // key: switching channels starts the view fresh instead of carrying the draft over.
        <ChannelView key={page.activeChannel.id} channel={page.activeChannel} />
      ) : (
        <p className="chat-empty">{page.channelsLoading ? "Carregando canais..." : "Nenhum canal de texto."}</p>
      )}
      {/* In a call the stage takes the rest of the screen; only the channels column stays. */}
      {!page.inCall && (
        <MemberList server={page.server} members={page.members} currentUserId={page.currentUserId} />
      )}
      {page.settings && (
        <ChannelSettings
          server={page.server}
          channel={page.settings.channel}
          type={page.settings.type}
          members={page.members}
          onClose={page.closeChannelSettings}
          onCreated={page.onChannelCreated}
        />
      )}
    </div>
  );
}
