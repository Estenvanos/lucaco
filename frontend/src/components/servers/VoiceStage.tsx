import type { VoiceMediaProps, VoiceStageProps } from "../../types/ui.types";

function VoiceMedia({ item, outputId, deafened }: VoiceMediaProps) {
  const attach = (node: HTMLMediaElement | null) => {
    if (!node) return;
    node.srcObject = item.stream;
    if (outputId && "setSinkId" in node) void node.setSinkId(outputId).catch(() => {});
  };

  if (!item.hasVideo) return <audio ref={attach} autoPlay muted={deafened} />;
  return (
    <figure className="voice-stream">
      <video ref={attach} autoPlay playsInline muted={deafened || item.key === "local-screen"} />
      <figcaption>{item.label}</figcaption>
    </figure>
  );
}

export function VoiceStage({ voice, outputId }: VoiceStageProps) {
  const screens = voice.streams.filter((item) => item.hasVideo);

  return (
    <section className="voice-stage">
      <div className="voice-streams">
        {screens.length ? screens.map((item) => <VoiceMedia key={item.key} item={item} outputId={outputId} deafened={voice.deafened} />) : (
          <div className="voice-stage-empty">
            <strong>Nenhuma aba sendo transmitida</strong>
            <p>Use “Transmitir aba” e marque o áudio da aba no seletor do navegador.</p>
          </div>
        )}
        {voice.streams.filter((item) => !item.hasVideo).map((item) => (
          <VoiceMedia key={item.key} item={item} outputId={outputId} deafened={voice.deafened} />
        ))}
      </div>
      {voice.error && <p className="voice-stage-error" role="alert">{voice.error}</p>}
    </section>
  );
}
