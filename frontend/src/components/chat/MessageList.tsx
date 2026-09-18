import { formatDateTime } from "../../lib/utils";
import type { MessageListProps } from "../../types/ui.types";
import { ChatAvatar } from "./ChatAvatar";

/**
 * column-reverse on the scroller keeps the view pinned to the newest message as rows arrive,
 * with no scroll effect: the browser anchors to the bottom by itself.
 */
export function MessageList({ rows, me, peer, typing, hasOlder, loadingOlder, onLoadOlder }: MessageListProps) {
  const peerName = peer.displayName ?? peer.username;

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
            <strong>{peerName}</strong>
            <p>Este é o começo da sua conversa com @{peer.username}. Só vocês dois conseguem ler.</p>
          </div>
        )}

        {rows.map((row) => {
          const author = row.senderId === me.id ? me : peer;
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
                  {row.text === null ? (
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
          {typing && (
            <>
              <span className="chat-typing-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <strong>{peerName}</strong> está digitando...
            </>
          )}
        </p>
      </div>
    </div>
  );
}
