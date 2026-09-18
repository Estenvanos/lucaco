import { X } from "lucide-react";
import { useChannelChat } from "../../hooks/useChannelChat";
import type { ChannelViewProps } from "../../types/ui.types";
import { Composer } from "../chat/Composer";
import { MessageList } from "../chat/MessageList";

export function ChannelView({ channel, onClose }: ChannelViewProps) {
  const chat = useChannelChat(channel);

  return (
    <section className="chat-main">
      <header className="chat-header">
        <h1>
          <span className="server-hash" aria-hidden>
            #
          </span>
          {channel.name}
        </h1>
        {channel.topic && <span className="chat-header-typing">{channel.topic}</span>}
        {onClose && (
          <button type="button" className="voice-icon-button chat-header-close" title="Fechar chat" onClick={onClose}>
            <X aria-hidden />
            <span className="sr-only">Fechar chat</span>
          </button>
        )}
      </header>
      {chat.loadError ? (
        <p className="chat-empty">{chat.loadError}</p>
      ) : chat.loading ? (
        <p className="chat-empty">Abrindo canal seguro...</p>
      ) : (
        <MessageList
          rows={chat.rows}
          authorOf={chat.authorOf}
          intro={chat.intro}
          typingName={null}
          hasOlder={chat.hasOlder}
          loadingOlder={chat.loadingOlder}
          onLoadOlder={chat.loadOlder}
        />
      )}
      <Composer {...chat.composer} />
    </section>
  );
}
