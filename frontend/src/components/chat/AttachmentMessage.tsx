import { File as FileIcon, Play } from "lucide-react";
import { useState } from "react";
import { formatBytes } from "../../lib/utils";
import { saveAttachment, useAttachment } from "../../services/messages/messages.media";
import type { AttachmentMessageProps } from "../../types/ui.types";

/**
 * An image shows itself. A video or document is a card: nothing (up to 100 MB) is downloaded
 * until the user asks, by playing the video or saving the document.
 */
export function AttachmentMessage({ attachment }: AttachmentMessageProps) {
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const media = useAttachment(attachment, attachment.kind === "image" || playing);

  if (attachment.kind === "image") {
    if (media.error) return <p className="chat-undecryptable">{media.error.message}</p>;
    if (!media.data) return <p className="chat-audio-loading">Carregando imagem...</p>;
    return <img className="chat-attachment-image" src={media.data} alt={attachment.name} />;
  }

  if (attachment.kind === "video" && playing && media.data) {
    return <video className="chat-attachment-video" controls autoPlay preload="metadata" poster={attachment.thumb} src={media.data} />;
  }

  const error = media.error?.message ?? saveError;
  const busy = saving || (playing && media.isPending);

  // A video with its first frame: click the picture to load and play it.
  if (attachment.kind === "video" && attachment.thumb) {
    return (
      <button
        type="button"
        className="chat-video-poster"
        disabled={busy}
        title={`Reproduzir ${attachment.name}`}
        onClick={() => setPlaying(true)}
      >
        <img src={attachment.thumb} alt={attachment.name} />
        <span className="chat-video-play">{error ?? (busy ? "Carregando..." : <Play aria-hidden />)}</span>
        <small>{formatBytes(attachment.size)}</small>
      </button>
    );
  }

  const save = () => {
    setSaving(true);
    setSaveError(null);
    saveAttachment(attachment)
      .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : "Não foi possível baixar"))
      .finally(() => setSaving(false));
  };
  return (
    <div className="chat-file">
      <FileIcon aria-hidden />
      <span className="chat-file-info">
        <strong title={attachment.name}>{attachment.name}</strong>
        <small>{error ?? formatBytes(attachment.size)}</small>
      </span>
      <button
        type="button"
        className="button-ghost"
        disabled={busy}
        onClick={attachment.kind === "video" ? () => setPlaying(true) : save}
      >
        {attachment.kind === "video" ? <Play aria-hidden /> : null}
        {busy ? "Carregando..." : attachment.kind === "video" ? "Reproduzir" : "Baixar"}
      </button>
    </div>
  );
}
