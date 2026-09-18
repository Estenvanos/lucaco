import { useVoiceMessage } from "../../services/messages/messages.media";
import { formatDuration } from "../../lib/utils";
import type { AudioMessageProps } from "../../types/ui.types";

/** Native <audio controls>: play, seek and volume come from the browser. */
export function AudioMessage({ audio }: AudioMessageProps) {
  const voice = useVoiceMessage(audio);

  if (voice.error) return <p className="chat-undecryptable">{voice.error.message}</p>;
  if (!voice.data) return <p className="chat-audio-loading">Carregando áudio ({formatDuration(audio.durationMs)})...</p>;
  return <audio className="chat-audio" controls preload="metadata" src={voice.data} />;
}
