import type { ChatHeaderProps } from "../../types/ui.types";
import { ChatAvatar } from "./ChatAvatar";

export function ChatHeader({ peer, typing }: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <ChatAvatar user={peer} />
      <h1>{peer.displayName ?? peer.username}</h1>
      {typing && <span className="chat-header-typing">digitando...</span>}
    </header>
  );
}
