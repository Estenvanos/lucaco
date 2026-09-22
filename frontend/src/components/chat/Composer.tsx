import { File as FileIcon, Mic, Paperclip, Square, Trash2, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { EVERYONE } from "../../lib/mentions";
import { ATTACHMENT_ACCEPT, LIMITS } from "../../constants/limits";
import { formatBytes, formatDuration } from "../../lib/utils";
import type { ComposerProps } from "../../types/ui.types";

const MAX_SUGGESTIONS = 6;

export function Composer({
  placeholder,
  label,
  blocked,
  sending,
  error,
  voice,
  attacher,
  mentionNames,
  onSubmit,
  onInput,
  onKeyDown,
}: ComposerProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // `from`: where the "@" sits in the text. The textarea stays uncontrolled, so it is edited in place.
  const [suggest, setSuggest] = useState<{ from: number; options: string[] } | null>(null);
  const [active, setActive] = useState(0);

  const update = (el: HTMLTextAreaElement) => {
    const typing = mentionNames && /(?<![\p{L}\p{N}_])@([^\s@]*)$/u.exec(el.value.slice(0, el.selectionStart));
    const options = typing
      ? [...new Set([EVERYONE, ...mentionNames])]
          .filter((name) => name.toLowerCase().startsWith(typing[1]!.toLowerCase()))
          .slice(0, MAX_SUGGESTIONS)
      : [];
    setSuggest(typing && options.length ? { from: typing.index, options } : null);
    setActive(0);
  };

  const pick = (name: string) => {
    const el = textarea.current;
    if (!el || !suggest) return;
    el.setRangeText(`@${name} `, suggest.from, el.selectionStart, "end");
    setSuggest(null);
    el.focus();
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!suggest) return onKeyDown(event);
    const { options } = suggest;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pick(options[active]!);
    } else if (event.key === "Escape") setSuggest(null);
    else onKeyDown(event);
  };

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
  const shownError = voice?.error ?? attacher?.error ?? error;

  return (
    // With a file waiting, Enter and the send button send the file; the typed text stays for later.
    <form className="chat-composer" onSubmit={(event) => (attacher?.pending ? (event.preventDefault(), attacher.send()) : onSubmit(event))}>
      {shownError && (
        <p className="chat-composer-error" role="alert">
          {shownError}
        </p>
      )}
      {attacher?.pending && (
        <div className="chat-attach-tray" aria-label="Arquivo para enviar">
          <div className="chat-attach-preview" data-kind={attacher.pending.kind}>
            {attacher.pending.kind === "image" ? (
              <img src={attacher.pending.url} alt={attacher.pending.file.name} />
            ) : attacher.pending.kind === "video" ? (
              // #t makes the browser show a real frame, not black; controls let the user watch it before sending.
              <video
                src={`${attacher.pending.url}#t=0.1`}
                poster={attacher.pending.thumb ?? undefined}
                controls
                preload="metadata"
              />
            ) : (
              <FileIcon aria-hidden />
            )}
          </div>
          <span className="chat-attach-info">
            <strong title={attacher.pending.file.name}>{attacher.pending.file.name}</strong>
            <small>{formatBytes(attacher.pending.file.size)}</small>
          </span>
          <button type="button" className="button-ghost" disabled={attacher.sending} onClick={attacher.clear}>
            <X aria-hidden /> Remover
          </button>
          <button type="button" className="button" disabled={attacher.sending} onClick={attacher.send}>
            {attacher.sending ? "Enviando..." : "Enviar arquivo"}
          </button>
        </div>
      )}
      {suggest && (
        <ul className="mention-suggest" role="listbox" aria-label="Mencionar">
          {suggest.options.map((name, i) => (
            <li key={name} role="option" aria-selected={i === active}>
              {/* mousedown, not click: the textarea would blur first and close the list */}
              <button type="button" tabIndex={-1} data-active={i === active} onMouseDown={(e) => (e.preventDefault(), pick(name))}>
                @{name}
                {name === EVERYONE && <small>Todos do canal</small>}
              </button>
            </li>
          ))}
        </ul>
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
            placeholder={voice?.state === "sending" ? "Enviando áudio..." : attacher?.sending ? "Enviando arquivo..." : placeholder}
            aria-label={label}
            maxLength={LIMITS.messageText.max}
            autoFocus
            ref={textarea}
            onInput={(event) => {
              update(event.currentTarget);
              onInput?.();
            }}
            onPaste={(event) => {
              // Ctrl+V of a screenshot or a copied file. Text (even with an image rendition of it,
              // as Word and Excel add) pastes as text.
              const file = event.clipboardData.files[0];
              if (!attacher || !file || event.clipboardData.getData("text/plain")) return;
              event.preventDefault();
              attacher.pick(file);
            }}
            onBlur={() => setSuggest(null)}
            onKeyDown={keyDown}
          />
        )}
        {attacher && !recording && (
          <>
            {/* Allowed formats only: the kind (image, video, document) is read from its type after it is picked. */}
            <input
              ref={fileInput}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = ""; // picking the same file again must fire onChange
                if (file) attacher.pick(file);
              }}
            />
            <button
              type="button"
              className="chat-send chat-voice"
              disabled={attacher.sending}
              title="Anexar arquivo"
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip aria-hidden />
              <span className="sr-only">Anexar arquivo</span>
            </button>
          </>
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
