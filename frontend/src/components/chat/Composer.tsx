import { LIMITS } from "../../constants/limits";
import type { ComposerProps } from "../../types/ui.types";

export function Composer({ peerName, sending, error, onSubmit, onInput, onKeyDown }: ComposerProps) {
  return (
    <form className="chat-composer" onSubmit={onSubmit}>
      {error && (
        <p className="chat-composer-error" role="alert">
          {error}
        </p>
      )}
      <div className="chat-composer-box">
        <textarea
          name="text"
          rows={1}
          placeholder={`Conversar com @${peerName}`}
          aria-label={`Mensagem para ${peerName}`}
          maxLength={LIMITS.messageText.max}
          autoFocus
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="chat-send" disabled={sending} title="Enviar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <span className="sr-only">Enviar</span>
        </button>
      </div>
    </form>
  );
}
