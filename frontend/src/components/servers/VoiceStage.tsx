import {
  ChevronDown,
  Maximize,
  MessageCircle,
  Mic,
  MicOff,
  Minimize,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { LIMITS } from "../../constants/limits";
import { useFullscreen } from "../../hooks/useFullscreen";
import { playbackOf } from "../../services/voice/voice";
import type { StreamViewersProps, VoiceMediaProps, VoiceStageProps, VoiceTileProps } from "../../types/ui.types";
import { ChatAvatar } from "../chat/ChatAvatar";
import { ChannelView } from "./ChannelView";
import { openContextMenu } from "../../lib/context-menu";
import { VoiceUserMenu } from "./VoiceUserMenu";

function VoiceMedia({ item, outputId, deafened, audio, volume }: VoiceMediaProps) {
  const attachAudio = (node: HTMLAudioElement | null) => {
    if (!node) return;
    // Up to 200% through a GainNode; the same output stream comes back while the input is unchanged.
    const stream = playbackOf(item.key, item.stream, volume);
    // Reassigning the same stream reloads the element: skip it on every re-render.
    if (node.srcObject !== stream) node.srcObject = stream;
    if (outputId && "setSinkId" in node) void node.setSinkId(outputId).catch(() => {});
  };
  const attachVideo = (node: HTMLVideoElement | null) => {
    if (node && node.srcObject !== item.stream) node.srcObject = item.stream;
  };

  // Per-user mute applies to the microphone; the shared tab only has its own volume.
  const sound = <audio ref={attachAudio} autoPlay muted={deafened || audio?.muted} />;
  if (!item.hasVideo) return sound;
  return (
    <>
      <video className="voice-watch-video" ref={attachVideo} autoPlay playsInline muted />
      {sound}
    </>
  );
}

const VIEWERS_SHOWN = 5;

function StreamViewers({ viewers }: StreamViewersProps) {
  if (!viewers.length) return <p className="voice-viewers">Ninguém assistindo</p>;
  const names = viewers.map((person) => person.displayName ?? person.username).join(", ");
  // Avatars only; the names stay in the tooltip and for screen readers.
  return (
    <p className="voice-viewers" title={`Assistindo: ${names}`} aria-label={`Assistindo: ${names}`}>
      <span className="voice-viewers-avatars">
        {viewers.slice(0, VIEWERS_SHOWN).map((person) => (
          <ChatAvatar key={person.id} user={person} />
        ))}
        {viewers.length > VIEWERS_SHOWN && <span className="voice-viewers-more">+{viewers.length - VIEWERS_SHOWN}</span>}
      </span>
    </p>
  );
}

function VoiceTile({ tile, local, preview, onWatch, onVolume, onMute }: VoiceTileProps) {
  const name = tile.person.displayName ?? tile.person.username;
  return (
    <figure
      className="voice-tile"
      data-speaking={tile.speaking}
      tabIndex={local ? undefined : 0}
      onContextMenu={local ? undefined : openContextMenu}
    >
      {local && tile.sharing && preview && <img className="voice-tile-preview" src={preview} alt="" />}
      <ChatAvatar user={tile.person} size="lg" />
      {!local && (
        <button
          type="button"
          className="voice-tile-menu-button"
          aria-haspopup="menu"
          aria-label={`Áudio de ${name}`}
          title={`Áudio de ${name}`}
          onClick={(event) => openContextMenu(event, event.currentTarget.parentElement?.querySelector<HTMLElement>("[popover]"))}
        >
          <ChevronDown aria-hidden />
        </button>
      )}
      {tile.sharing && (
        <div className="voice-tile-live">
          <span className="voice-live-badge">{local ? "Você está transmitindo" : "Ao vivo"}</span>
          {!local && (
            <button type="button" className="voice-watch-button" onClick={onWatch}>
              Assistir
            </button>
          )}
          <StreamViewers viewers={tile.viewers} />
        </div>
      )}
      <figcaption className="voice-tile-name">
        {tile.muted && <MicOff aria-label="Microfone mutado" />}
        {tile.audio.muted && <VolumeX aria-label="Silenciado para você" />}
        {name}
      </figcaption>
      {!local && <VoiceUserMenu name={name} audio={tile.audio} onVolume={onVolume} onMute={onMute} />}
    </figure>
  );
}

export function VoiceStage({
  voice,
  outputId,
  channelName,
  tiles,
  chatChannel,
  chatOpen,
  onToggleChat,
  onMute,
  onDeafen,
  onShare,
  onLeave,
  onUserVolume,
  onUserMute,
  onWatch,
  onUnwatch,
  onStreamVolume,
}: VoiceStageProps) {
  const fullscreen = useFullscreen();
  const watched = voice.watching ? tiles.find((tile) => tile.socketId === voice.watching) : undefined;
  const watchedStream = voice.watching
    ? voice.streams.find((item) => item.hasVideo && item.key.startsWith(`${voice.watching}:`))
    : undefined;
  // Remote stream keys are "<socketId>:<streamId>".
  const audioOf = (key: string) => tiles.find((tile) => tile.socketId === key.split(":")[0])?.audio;

  return (
    <div className="voice-call">
      <section className="voice-stage" aria-label="Chamada de voz">
        <header className="voice-stage-head">
          <h1>
            <Volume2 aria-hidden />
            {watched ? `Transmissão de ${watched.person.displayName ?? watched.person.username}` : channelName}
          </h1>
          {watched && <StreamViewers viewers={watched.viewers} />}
          {watched && (
            <label className="voice-stream-volume" title="Volume da transmissão (só para você)">
              <Volume2 aria-hidden />
              <span className="sr-only">Volume da transmissão</span>
              <input
                type="range"
                min={0}
                max={LIMITS.playbackVolume * 100}
                value={Math.round(voice.streamVolume * 100)}
                onChange={(event) => onStreamVolume(event.currentTarget.valueAsNumber / 100)}
              />
              <output>{Math.round(voice.streamVolume * 100)}%</output>
            </label>
          )}
          {watched && (
            <button type="button" className="voice-leave-stream" onClick={onUnwatch}>
              <X aria-hidden />
              Sair da transmissão
            </button>
          )}
          {chatChannel && (
            <button
              type="button"
              className="voice-icon-button"
              aria-pressed={chatOpen}
              aria-label="Abrir chat"
              title="Abrir chat"
              onClick={onToggleChat}
            >
              <MessageCircle aria-hidden />
            </button>
          )}
        </header>

        {/* Microphones play in both views: watching a stream keeps the conversation going. */}
        {voice.streams
          .filter((item) => !item.hasVideo)
          .map((item) => (
            <VoiceMedia
              key={item.key}
              item={item}
              outputId={outputId}
              deafened={voice.deafened}
              audio={audioOf(item.key)}
              volume={audioOf(item.key)?.volume ?? 1}
            />
          ))}

        {voice.watching ? (
          <div className="voice-watch">
            {watchedStream ? (
              <VoiceMedia
                item={watchedStream}
                outputId={outputId}
                deafened={voice.deafened}
                audio={undefined}
                volume={voice.streamVolume}
              />
            ) : (
              <p className="voice-watch-waiting">Conectando à transmissão...</p>
            )}
          </div>
        ) : (
          <div className="voice-tiles">
            {tiles.map((tile) => (
              <VoiceTile
                key={tile.socketId}
                tile={tile}
                local={tile.socketId === voice.socketId}
                preview={voice.preview}
                onWatch={() => onWatch(tile.socketId)}
                onVolume={(volume) => onUserVolume(tile.person.id, volume)}
                onMute={() => onUserMute(tile.person.id)}
              />
            ))}
          </div>
        )}

        {voice.error && <p className="voice-stage-error" role="alert">{voice.error}</p>}

        <footer className="voice-stage-bar">
          {/* Outside fullscreen the channels column already has these controls. */}
          {fullscreen.isFullscreen && (
            <div className="voice-stage-controls">
              <button type="button" aria-pressed={voice.muted} title={voice.muted ? "Ativar microfone" : "Mutar microfone"} onClick={onMute}>
                {voice.muted ? <MicOff aria-hidden /> : <Mic aria-hidden />}
                <span className="sr-only">{voice.muted ? "Ativar microfone" : "Mutar microfone"}</span>
              </button>
              <button type="button" aria-pressed={voice.deafened} title={voice.deafened ? "Ativar áudio" : "Silenciar áudio"} onClick={onDeafen}>
                {voice.deafened ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
                <span className="sr-only">{voice.deafened ? "Ativar áudio" : "Silenciar áudio"}</span>
              </button>
              <button type="button" aria-pressed={voice.sharing} title={voice.sharing ? "Parar transmissão" : "Transmitir aba"} onClick={onShare}>
                {voice.sharing ? <ScreenShareOff aria-hidden /> : <ScreenShare aria-hidden />}
                <span className="sr-only">{voice.sharing ? "Parar transmissão" : "Transmitir aba"}</span>
              </button>
              <button type="button" className="voice-stage-leave" title="Desconectar" onClick={onLeave}>
                <PhoneOff aria-hidden />
                <span className="sr-only">Desconectar</span>
              </button>
            </div>
          )}
          <button
            type="button"
            className="voice-icon-button voice-stage-fullscreen"
            title={fullscreen.isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            onClick={(event) => fullscreen.toggle(event.currentTarget.closest(".voice-call"))}
          >
            {fullscreen.isFullscreen ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
            <span className="sr-only">{fullscreen.isFullscreen ? "Sair da tela cheia" : "Tela cheia"}</span>
          </button>
        </footer>
      </section>

      {chatOpen && chatChannel && <ChannelView key={chatChannel.id} channel={chatChannel} onClose={onToggleChat} />}
    </div>
  );
}
