import { useState } from "react";
import { ApiError } from "../lib/api";
import { videoThumb } from "../lib/thumbnail";
import { attachmentKind, checkAttachment } from "../services/messages/messages.media";
import type { Attacher, PendingFile } from "../types/messages.types";

/**
 * A picked or pasted file waits in the composer with a local preview (`pending`) until the user
 * sends it (`send`, which calls `upload`) or removes it (`clear`). One file per message.
 */
export function useAttacher(upload: (file: File, thumb: string | null) => Promise<void>): Attacher {
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const pick = (file: File) => {
    const problem = checkAttachment(file);
    setError(problem);
    if (problem || sending) return;
    if (pending) URL.revokeObjectURL(pending.url);
    const url = URL.createObjectURL(file);
    const kind = attachmentKind(file);
    setPending({ file, kind, url, thumb: null });
    // The first frame is what the message card will show before anyone plays the video.
    if (kind === "video") {
      videoThumb(url).then((thumb) => setPending((current) => (current?.url === url ? { ...current, thumb } : current)));
    }
  };

  const send = () => {
    if (!pending || sending) return;
    setSending(true);
    setError(null);
    upload(pending.file, pending.thumb)
      .then(clear)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Arquivo não enviado"))
      .finally(() => setSending(false));
  };

  return { pending, sending, error, pick, clear, send };
}
