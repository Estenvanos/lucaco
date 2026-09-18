import { Mic, Square, Trash2 } from "lucide-react";
import { LIMITS } from "../../constants/limits";
import { formatDuration } from "../../lib/utils";
import type { ComposerProps } from "../../types/ui.types";

export function Composer({ placeholder, label, blocked, sending, error, voice, onSubmit, onInput, onKeyDown }: ComposerProps) {
  if (blocked) {
    return (
      <div className="chat-composer">
        <div className="chat-composer-box">
          <textarea rows={1} placeholder={blocked} aria-label={label} disabled />
        </div>
      </div>
    );
  }

  const recording = voice?.state === "recording";
  const shownError = voice?.error ?? error;

  return (
    <form className="chat-composer" onSubmit={onSubmit}>
      {shownError && (
        <p className="chat-composer-error" role="alert">
          {shownError}
        </p>
      )}
      <div className="chat-composer-box" ref={voice?.attach}>
        {recording ? (
          <p className="chat-recording" aria-live="polite">
            <span className="chat-recording-dot" aria-hidden />
            Gravando {formatDuration(voice.elapsedMs)} / {formatDuration(LIMITS.voiceMessageMs)}
          </p>
        ) : (
          <textarea
            name="text"
            rows={1}
            placeholder={voice?.state === "sending" ? "Enviando áudio..." : placeholder}
            aria-label={label}
            maxLength={LIMITS.messageText.max}
            autoFocus
            onInput={onInput}
            onKeyDown={onKeyDown}
          />
        )}
        {voice && recording && (
          <button type="button" className="chat-send chat-voice-cancel" title="Descartar áudio" onClick={() => voice.stop(false)}>
            <Trash2 aria-hidden />
            <span className="sr-only">Descartar áudio</span>
          </button>
        )}
        {voice && (
          <button
            type="button"
            className="chat-send chat-voice"
            aria-pressed={recording}
            disabled={voice.state === "sending"}
            title={recording ? "Enviar áudio" : "Gravar áudio"}
            onClick={() => (recording ? voice.stop(true) : voice.start())}
          >
            {recording ? <Square aria-hidden /> : <Mic aria-hidden />}
            <span className="sr-only">{recording ? "Enviar áudio" : "Gravar áudio"}</span>
          </button>
        )}
        {!recording && (
          <button type="submit" className="chat-send" disabled={sending} title="Enviar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="sr-only">Enviar</span>
          </button>
        )}
      </div>
    </form>
  );
}
