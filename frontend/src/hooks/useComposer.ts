import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiError } from "../lib/api";
import type { Outgoing } from "../types/messages.types";

/** Text box state shared by the DM and the channel chat: submit, Enter to send, the send error. */
export function useComposer(send: (out: Outgoing) => Promise<void>) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = String(new FormData(form).get("text") ?? "").trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    send({ text, audio: null, attachment: null })
      .then(() => form.reset())
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Mensagem não enviada"))
      .finally(() => setSending(false));
  };

  return {
    sending,
    error,
    onSubmit,
    // Enter sends, Shift+Enter breaks the line.
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        event.currentTarget.form?.requestSubmit();
      }
    },
  };
}
