import { Download, File as FileIcon, Play } from "lucide-react";
import { useState } from "react";
import { formatBytes } from "../../lib/utils";
import { saveAttachment, useAttachment, useImageUrls } from "../../services/messages/messages.media";
import type { AttachmentMessageProps } from "../../types/ui.types";

/**
 * An image shows its small preview, loaded lazily when scrolled near; a click opens the full one.
 * A video is a player with its first frame as cover; a document is a card. Nothing (up to 100 MB)
 * is downloaded until the user asks, by playing the video or saving the file.
 */
export function AttachmentMessage({ attachment }: AttachmentMessageProps) {
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const media = useAttachment(attachment, playing);
  const image = useImageUrls(attachment.mediaId, attachment.kind === "image");

  if (attachment.kind === "image") {
    if (image.error) return <p className="chat-undecryptable">{image.error.message}</p>;
    if (!image.data) return <p className="chat-audio-loading">Carregando imagem...</p>;
    return (
      <a href={image.data.url} target="_blank" rel="noopener noreferrer" title={`Abrir ${attachment.name}`}>
        <img
          className="chat-attachment-image"
          src={image.data.previewUrl ?? image.data.url}
          alt={attachment.name}
          width={attachment.width}
          height={attachment.height}
          loading="lazy"
          decoding="async"
        />
      </a>
    );
  }

  const error = media.error?.message ?? saveError;
  const busy = saving || (playing && media.isPending);
  const save = () => {
    setSaving(true);
    setSaveError(null);
    saveAttachment(attachment)
      .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : "Não foi possível baixar"))
      .finally(() => setSaving(false));
  };

  if (attachment.kind === "video") {
    return (
      <div className="chat-video">
        {playing && media.data ? (
          <video controls autoPlay preload="metadata" poster={attachment.thumb} src={media.data} />
        ) : (
          <button
            type="button"
            className="chat-video-poster"
            disabled={busy}
            title={`Reproduzir ${attachment.name}`}
            onClick={() => setPlaying(true)}
          >
            {attachment.thumb ? <img src={attachment.thumb} alt={attachment.name} /> : null}
            <span className="chat-video-bar">
              <Play aria-hidden />
              <small>{error ?? (busy ? "Carregando..." : formatBytes(attachment.size))}</small>
            </span>
          </button>
        )}
        <button type="button" className="chat-video-download" disabled={saving} title={`Baixar ${attachment.name}`} onClick={save}>
          <Download aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="chat-file">
      <FileIcon aria-hidden />
      <span className="chat-file-info">
        <strong title={attachment.name}>{attachment.name}</strong>
        <small>{error ?? formatBytes(attachment.size)}</small>
      </span>
      <button type="button" className="button button-ghost" disabled={busy} onClick={save}>
        <Download aria-hidden />
        {busy ? "Carregando..." : "Baixar"}
      </button>
    </div>
  );
}
