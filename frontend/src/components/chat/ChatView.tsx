import { useConversation } from "../../hooks/useConversation";
import type { ChatViewProps } from "../../types/ui.types";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { ProfileCard } from "./ProfileCard";

export function ChatView({ peerId }: ChatViewProps) {
  const chat = useConversation(peerId);

  if (chat.notFriend) return <p className="chat-empty">Você só pode conversar com amigos.</p>;
  if (!chat.peer) return null;
  const peerName = chat.peer.displayName ?? chat.peer.username;

  return (
    <div className="chat">
      <section className="chat-main">
        <ChatHeader peer={chat.peer} typing={chat.peerTyping} />
        {chat.loadError ? (
          <p className="chat-empty">{chat.loadError}</p>
        ) : chat.loading ? (
          <p className="chat-empty">Abrindo conversa segura...</p>
        ) : (
          <MessageList
            rows={chat.rows}
            me={chat.me}
            peer={chat.peer}
            typing={chat.peerTyping}
            hasOlder={chat.hasOlder}
            loadingOlder={chat.loadingOlder}
            onLoadOlder={chat.loadOlder}
          />
        )}
        <Composer peerName={peerName} {...chat.composer} />
      </section>
      <ProfileCard user={chat.peer} />
    </div>
  );
}
