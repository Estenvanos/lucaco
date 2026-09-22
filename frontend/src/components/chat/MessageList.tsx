import { Trash2 } from "lucide-react";
import { EVERYONE, splitMentions } from "../../lib/mentions";
import { formatDateTime } from "../../lib/utils";
import type { MessageListProps } from "../../types/ui.types";
import { AttachmentMessage } from "./AttachmentMessage";
import { AudioMessage } from "./AudioMessage";
import { ChatAvatar } from "./ChatAvatar";

/**
 * column-reverse on the scroller keeps the view pinned to the newest message as rows arrive,
 * with no scroll effect: the browser anchors to the bottom by itself.
 */
export function MessageList({
  rows,
  authorOf,
  intro,
  typingName,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  mentionNames,
  myName,
  canDelete,
  onDelete,
}: MessageListProps) {
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
                  ) : row.attachment ? (
                    <AttachmentMessage attachment={row.attachment} />
                  ) : row.text === null ? (
                    <p className="chat-undecryptable">Não foi possível decifrar esta mensagem.</p>
                  ) : (
                    <p>
                      {mentionNames
                        ? splitMentions(row.text, mentionNames).map((part, i) =>
                            part.mention ? (
                              <mark
                                key={i}
                                className="mention"
                                data-me={[EVERYONE, myName?.toLowerCase()].includes(part.text.slice(1).toLowerCase())}
                              >
                                {part.text}
                              </mark>
                            ) : (
                              part.text
                            ),
                          )
                        : row.text}
                    </p>
                  )}
                </div>
                {canDelete(row) && (
                  <button type="button" className="chat-message-delete" title="Excluir mensagem" onClick={() => onDelete(row)}>
                    <Trash2 aria-hidden />
                    <span className="sr-only">Excluir mensagem</span>
                  </button>
                )}
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
