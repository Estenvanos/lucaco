import { useRef, useState } from "react";
import { LIMITS } from "../constants/limits";
import { ApiError } from "../lib/api";
import { openProcessedMic } from "../services/audio/processing";
import type { UserSettings } from "../types/users.types";
import type { RecorderState, RecordingSession, VoiceRecorder } from "../types/messages.types";
import type { ProcessedMic } from "../types/voice.types";

/** Opus first (Chrome, Firefox); Safari only records mp4/aac. */
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

/**
 * Records a voice message with MediaRecorder, all from the click handlers: start opens the mic,
 * stop(true) hands the recording to `onRecorded`, stop(false) throws it away. The recording ends
 * by itself at LIMITS.voiceMessageMs. The mic goes through the user's noise suppression and EQ.
 */
export function useVoiceRecorder(
  settings: UserSettings,
  onRecorded: (recording: Blob, durationMs: number) => Promise<void>,
): VoiceRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<RecordingSession | null>(null);

  const stop = (send: boolean) => {
    const current = session.current;
    if (!current || current.recorder.state === "inactive") return;
    current.send = send;
    current.recorder.stop();
  };

  const start = async () => {
    if (session.current) return;
    setError(null);
    let mic: ProcessedMic;
    try {
      mic = await openProcessedMic(settings);
    } catch {
      setError("Não foi possível usar o microfone");
      return;
    }
    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const { stream } = mic;
    const recorder = new MediaRecorder(stream, { ...(mimeType && { mimeType }), audioBitsPerSecond: 32_000 });
    const chunks: Blob[] = [];
    const startedAt = Date.now();

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = () => {
      const done = session.current!;
      session.current = null;
      done.timers.forEach(clearTimeout);
      mic.close();
      setElapsedMs(0);
      if (!done.send) {
        setState("idle");
        return;
      }
      setState("sending");
      onRecorded(new Blob(chunks, { type: recorder.mimeType }), Date.now() - startedAt)
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Áudio não enviado"))
        .finally(() => setState("idle"));
    };

    session.current = {
      recorder,
      stream,
      startedAt,
      send: false,
      timers: [
        setInterval(() => setElapsedMs(Date.now() - startedAt), 250),
        setTimeout(() => stop(true), LIMITS.voiceMessageMs),
      ],
    };
    recorder.start();
    setState("recording");
  };

  // Stable across renders: a new ref callback would run the cleanup (and stop) on every tick.
  const [attach] = useState(() => (el: HTMLElement | null) => () => {
    if (el) stop(false);
  });

  return { state, elapsedMs, error, start: () => void start(), stop, attach };
}
