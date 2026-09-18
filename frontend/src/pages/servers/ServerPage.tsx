import { useParams } from "react-router";
import { ChannelView } from "../../components/servers/ChannelView";
import { MemberList } from "../../components/servers/MemberList";
import { ServerChannels } from "../../components/servers/ServerChannels";
import { VoiceStage } from "../../components/servers/VoiceStage";
import { useServerPage } from "../../hooks/useServerPage";

export function ServerPage() {
  const { serverId = "", channelId } = useParams();
  const page = useServerPage(serverId, channelId);

  if (!page.server) return null;

  return (
    <div className="server">
      <ServerChannels
        server={page.server}
        currentUserId={page.currentUserId}
        voiceChannel={page.voiceChannel}
        members={page.members}
        textChannels={page.textChannels}
        activeChannelId={page.activeChannel?.id ?? null}
        canManage={page.canManage}
        creating={page.creating}
        onToggleCreate={page.toggleCreating}
        createForm={page.createForm}
        voice={page.voice}
        onJoinVoice={page.joinVoice}
        onLeaveVoice={page.leaveVoice}
        onMuteVoice={page.toggleVoiceMute}
        onDeafenVoice={page.toggleVoiceDeafen}
        onShareVoice={page.toggleScreenShare}
      />
      {page.voice.channelId === page.voiceChannel?.id ? (
        <VoiceStage
          voice={page.voice}
          outputId={page.audioOutputId}
        />
      ) : page.activeChannel ? (
        // key: switching channels starts the view fresh instead of carrying the draft over.
        <ChannelView key={page.activeChannel.id} channel={page.activeChannel} />
      ) : (
        <p className="chat-empty">{page.channelsLoading ? "Carregando canais..." : "Nenhum canal de texto."}</p>
      )}
      <MemberList members={page.members} />
    </div>
  );
}
