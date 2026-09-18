import { formatDateTime } from "../../lib/utils";
import type { MessageListProps } from "../../types/ui.types";
import { AudioMessage } from "./AudioMessage";
import { ChatAvatar } from "./ChatAvatar";

/**
 * column-reverse on the scroller keeps the view pinned to the newest message as rows arrive,
 * with no scroll effect: the browser anchors to the bottom by itself.
 */
export function MessageList({ rows, authorOf, intro, typingName, hasOlder, loadingOlder, onLoadOlder }: MessageListProps) {
  return (
    <div className="chat-scroll">
      <div className="chat-messages">
        {hasOlder && (
          <button type="button" className="chat-older" disabled={loadingOlder} onClick={onLoadOlder}>
            {loadingOlder ? "Carregando..." : "Carregar mensagens anteriores"}
          </button>
        )}

        {!hasOlder && (
          <div className="chat-start">
            <strong>{intro.title}</strong>
            <p>{intro.text}</p>
          </div>
        )}

        {rows.map((row) => {
          const author = authorOf(row.senderId);
          return (
            <div key={row.id}>
              {row.day && (
                <div className="chat-day" role="separator">
                  <span>{row.day}</span>
                </div>
              )}
              <article className="chat-message" data-first={row.first}>
                {row.first && <ChatAvatar user={author} />}
                <div className="chat-message-body">
                  {row.first && (
                    <header>
                      <strong>{author.displayName ?? author.username}</strong>
                      <time dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time>
                    </header>
                  )}
                  {row.audio ? (
                    <AudioMessage audio={row.audio} />
                  ) : row.text === null ? (
                    <p className="chat-undecryptable">Não foi possível decifrar esta mensagem.</p>
                  ) : (
                    <p>{row.text}</p>
                  )}
                </div>
              </article>
            </div>
          );
        })}

        <p className="chat-typing" aria-live="polite">
          {typingName && (
            <>
              <span className="chat-typing-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <strong>{typingName}</strong> está digitando...
            </>
          )}
        </p>
      </div>
    </div>
  );
}
